import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  type UndoableGamePlay,
  useSessionElapsedMs,
} from "@/games/play";
import {
  restorePlayState,
  savePlayState,
} from "@/games/play-state-persistence";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  createShuttleParkingExitTimeline,
  type ShuttleParkingExitTimeline,
} from "@/games/shuttle-parking/play/exit-timeline";
import type {
  ShuttleParkingProblem,
  ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import type { ShuttleParkingPooledProblem } from "@/games/shuttle-parking/problem/problem-pool";
import { selectShuttleParkingProblemForDifficulty } from "@/games/shuttle-parking/problem-selection";
import type {
  ShuttleParkingCarId,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  isShuttleParkingStuck,
  type ShuttleParkingExitBlock,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";
import {
  calculateShuttleParkingPlayScore,
  calculateShuttleParkingSpeedScoreRule,
  type ShuttleParkingPlayScore,
  type ShuttleParkingSpeedReference,
} from "@/games/shuttle-parking/score";
import {
  attemptShuttleParkingSessionExit,
  canRestartShuttleParkingSession,
  canUndoShuttleParkingSession,
  createShuttleParkingSession,
  getShuttleParkingSessionResult,
  restartShuttleParkingSession,
  type ShuttleParkingSession,
  type ShuttleParkingSessionResult,
  undoShuttleParkingSession,
} from "@/games/shuttle-parking/session/session";

const SHUTTLE_PARKING_GAME_ID = "shuttle-parking";

export type ShuttleParkingOperation =
  | {
      id: number;
      type: "exited";
      carId: ShuttleParkingCarId;
      side: ShuttleParkingSide;
      timeline: ShuttleParkingExitTimeline;
      /** 出庫した時刻。演出と音は、この時刻から `timeline` の時刻を数える。 */
      startedAt: number;
    }
  | ({
      id: number;
      type: "blocked";
      carId: ShuttleParkingCarId;
    } & ShuttleParkingExitBlock);

export type ShuttleParkingResult = ShuttleParkingSessionResult & {
  speedReference: ShuttleParkingSpeedReference;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: ShuttleParkingPlayScore;
};

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createShuttleParkingResult(
  sessionResult: ShuttleParkingSessionResult,
  speedReference: ShuttleParkingSpeedReference,
): ShuttleParkingResult {
  const speedRule = calculateShuttleParkingSpeedScoreRule(speedReference);
  return {
    ...sessionResult,
    speedReference,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateShuttleParkingPlayScore({
      speedReference,
      elapsedMs: sessionResult.elapsedMs,
      trapCount: sessionResult.trapCount,
    }),
  };
}

export function getShuttleParkingSpeedReference({
  problem,
  trapWeight,
}: ShuttleParkingPooledProblem): ShuttleParkingSpeedReference {
  return {
    carCount: problem.lot.cars.length,
    passengerCount: problem.passengers.length,
    trapWeight,
  };
}

export type ShuttleParkingPlay = GamePlay<
  ShuttleParkingDifficulty,
  ShuttleParkingProblemIdentity,
  ShuttleParkingSession,
  ShuttleParkingResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    problem: ShuttleParkingProblem;
    state: ShuttleParkingState;
    operation: ShuttleParkingOperation | null;
    isStuck: boolean;
    undoCount: number;
    exitCar: (carId: ShuttleParkingCarId) => void;
  };

type ShuttleParkingPlayState = {
  session: ShuttleParkingSession;
  problemIdentity: ShuttleParkingProblemIdentity;
  speedReference: ShuttleParkingSpeedReference;
  operation: ShuttleParkingOperation | null;
  progress: GameProgress;
};

function createPlayState(
  pooled: ShuttleParkingPooledProblem,
  startedAt: number,
): ShuttleParkingPlayState {
  return {
    session: createShuttleParkingSession(pooled.problem, startedAt),
    problemIdentity: pooled.identity,
    speedReference: getShuttleParkingSpeedReference(pooled),
    operation: null,
    progress: "playing",
  };
}

function selectProblem(
  difficulty: ShuttleParkingDifficulty,
  avoidedProblemId: ProblemId | undefined,
): ShuttleParkingPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectShuttleParkingProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

export function useShuttleParkingPlay(
  difficulty: ShuttleParkingDifficulty,
  initialProblem?: ShuttleParkingPooledProblem,
  avoidedProblemId?: ProblemId,
  playProblemId?: ProblemId,
): ShuttleParkingPlay {
  const [play, setPlay] = useState<ShuttleParkingPlayState>(() =>
    restorePlayState(SHUTTLE_PARKING_GAME_ID, playProblemId, () =>
      createPlayState(
        initialProblem ?? selectProblem(difficulty, avoidedProblemId),
        Date.now(),
      ),
    ),
  );
  useEffect(
    () => savePlayState(SHUTTLE_PARKING_GAME_ID, playProblemId, play),
    [playProblemId, play],
  );
  const { session, problemIdentity, speedReference } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const exitCar = useCallback((carId: ShuttleParkingCarId) => {
    const attemptedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const attempt = attemptShuttleParkingSessionExit(
        current.session,
        carId,
        attemptedAt,
      );
      switch (attempt.outcome) {
        case "ignored":
          return current;
        case "exited":
          return {
            ...applyPlaySession(current, attempt.session),
            operation: {
              id: operationId,
              type: "exited",
              carId,
              side: attempt.side,
              timeline: createShuttleParkingExitTimeline(
                current.session.puzzleState,
                carId,
                attempt.events,
              ),
              startedAt: attemptedAt,
            },
          };
        case "blocked": {
          const { outcome, session: blockedSession, ...block } = attempt;
          return {
            ...applyPlaySession(current, blockedSession),
            operation: { id: operationId, type: outcome, ...block },
          };
        }
      }
    });
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoShuttleParkingSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartShuttleParkingSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createShuttleParkingSession(current.session.problem, startedAt),
      ),
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const result = useMemo(() => {
    const sessionResult = getShuttleParkingSessionResult(session);
    return sessionResult
      ? createShuttleParkingResult(sessionResult, speedReference)
      : null;
  }, [session, speedReference]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.clearedAt,
    elapsedMs,
    result,
    problem: session.problem,
    state: session.puzzleState,
    operation: play.operation,
    isStuck: isShuttleParkingStuck(session.problem, session.puzzleState),
    undoCount: session.undoCount,
    canUndo: canUndoShuttleParkingSession(session),
    canRestart: canRestartShuttleParkingSession(session),
    exitCar,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}

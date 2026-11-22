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
import type {
  ShuttleParkingIdentifiedProblem,
  ShuttleParkingProblem,
  ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import { selectShuttleParkingProblemForDifficulty } from "@/games/shuttle-parking/problem-selection";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import {
  isShuttleParkingStuck,
  type ShuttleParkingBoardingEvent,
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
      events: readonly ShuttleParkingBoardingEvent[];
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

export function getShuttleParkingSpeedReference(
  problem: ShuttleParkingProblem,
): ShuttleParkingSpeedReference {
  return {
    carCount: problem.lot.cars.length,
    passengerCount: problem.passengers.length,
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
  operation: ShuttleParkingOperation | null;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity }: ShuttleParkingIdentifiedProblem,
  startedAt: number,
): ShuttleParkingPlayState {
  return {
    session: createShuttleParkingSession(problem, startedAt),
    problemIdentity: identity,
    operation: null,
    progress: "playing",
  };
}

function selectProblem(
  difficulty: ShuttleParkingDifficulty,
  avoidedProblemId: ProblemId | undefined,
): ShuttleParkingIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectShuttleParkingProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

export function useShuttleParkingPlay(
  difficulty: ShuttleParkingDifficulty,
  initialProblem?: ShuttleParkingIdentifiedProblem,
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
  const { session, problemIdentity } = play;
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
              events: attempt.events,
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
      ? createShuttleParkingResult(
          sessionResult,
          getShuttleParkingSpeedReference(session.problem),
        )
      : null;
  }, [session]);

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

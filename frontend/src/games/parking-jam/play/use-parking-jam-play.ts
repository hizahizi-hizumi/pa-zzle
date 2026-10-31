import { useCallback, useMemo, useRef, useState } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type {
  ParkingJamIdentifiedProblem,
  ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import {
  createParkingJamInitialState,
  type ParkingJamBoard,
  type ParkingJamDirection,
  type ParkingJamState,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { listParkingJamLegalMoves } from "@/games/parking-jam/puzzle/rules";
import {
  calculateParkingJamPlayScore,
  calculateParkingJamSpeedScoreRule,
  type ParkingJamPlayScore,
  type ParkingJamSpeedReference,
} from "@/games/parking-jam/score";
import {
  attemptParkingJamSessionMove,
  canRestartParkingJamSession,
  canUndoParkingJamSession,
  createParkingJamSession,
  getParkingJamSessionResult,
  type ParkingJamSession,
  type ParkingJamSessionResult,
  restartParkingJamSession,
  undoParkingJamSession,
} from "@/games/parking-jam/session/session";
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
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

export type ParkingJamOperation = {
  id: number;
  type: "blocked" | "exited";
  vehicleId: ParkingJamVehicleId;
  direction: ParkingJamDirection;
};

export type ParkingJamResult = ParkingJamSessionResult & {
  speedReference: ParkingJamSpeedReference;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: ParkingJamPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createParkingJamResult(
  sessionResult: ParkingJamSessionResult,
  speedReference: ParkingJamSpeedReference,
): ParkingJamResult {
  const speedRule = calculateParkingJamSpeedScoreRule(speedReference);
  return {
    ...sessionResult,
    speedReference,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateParkingJamPlayScore({
      speedReference,
      elapsedMs: sessionResult.elapsedMs,
      failedMoveCount: sessionResult.failedMoveCount,
      undoCount: sessionResult.undoCount,
      restartCount: sessionResult.restartCount,
    }),
  };
}

export type ParkingJamPlay = GamePlay<
  ParkingJamDifficulty,
  ParkingJamProblemIdentity,
  ParkingJamSession,
  ParkingJamResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: ParkingJamBoard;
    state: ParkingJamState;
    selectedVehicleId: ParkingJamVehicleId | null;
    operation: ParkingJamOperation | null;
    moveAttemptCount: number;
    successfulMoveCount: number;
    failedMoveCount: number;
    undoCount: number;
    restartCount: number;
    selectVehicle: (vehicleId: ParkingJamVehicleId) => void;
    attemptMove: (
      vehicleId: ParkingJamVehicleId,
      direction: ParkingJamDirection,
    ) => void;
  };

type ParkingJamPlayState = {
  session: ParkingJamSession;
  problemIdentity: ParkingJamProblemIdentity;
  speedReference: ParkingJamSpeedReference;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  progress: GameProgress;
};

function getSpeedReference(board: ParkingJamBoard): ParkingJamSpeedReference {
  const initialLegalVehicleIds = new Set(
    listParkingJamLegalMoves(board, createParkingJamInitialState(board)).map(
      (move) => move.vehicleId,
    ),
  );
  return {
    vehicleCount: board.vehicles.length,
    initialBlockedVehicleCount:
      board.vehicles.length - initialLegalVehicleIds.size,
  };
}

function createPlayState(
  { problem, identity }: ParkingJamIdentifiedProblem,
  startedAt: number,
): ParkingJamPlayState {
  return {
    session: createParkingJamSession(problem, startedAt),
    problemIdentity: identity,
    speedReference: getSpeedReference(problem.board),
    selectedVehicleId: null,
    operation: null,
    progress: "playing",
  };
}

function selectProblem(
  difficulty: ParkingJamDifficulty,
  avoidedProblemId: ProblemId | undefined,
): ParkingJamIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectParkingJamProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/** `initialProblem` を渡すと、指定された問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useParkingJamPlay(
  difficulty: ParkingJamDifficulty,
  initialProblem?: ParkingJamIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): ParkingJamPlay {
  const [play, setPlay] = useState<ParkingJamPlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, speedReference } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const selectVehicle = useCallback((vehicleId: ParkingJamVehicleId) => {
    setPlay((current) => {
      if (
        current.session.status !== "playing" ||
        !current.session.puzzleState.remainingVehicleIds.includes(vehicleId)
      ) {
        return current;
      }

      return {
        ...current,
        selectedVehicleId:
          current.selectedVehicleId === vehicleId ? null : vehicleId,
        operation: null,
      };
    });
  }, []);

  const attemptMove = useCallback(
    (vehicleId: ParkingJamVehicleId, direction: ParkingJamDirection) => {
      const attemptedAt = Date.now();
      const operationId = nextOperationId.current++;
      setPlay((current) => {
        const attempt = attemptParkingJamSessionMove(
          current.session,
          { vehicleId, direction },
          attemptedAt,
        );
        if (attempt.outcome === "ignored") return current;

        return {
          ...applyPlaySession(current, attempt.session),
          selectedVehicleId:
            attempt.outcome === "exited" ? null : current.selectedVehicleId,
          operation: {
            id: operationId,
            type: attempt.outcome,
            vehicleId,
            direction,
          },
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoParkingJamSession(current.session),
      );
      return next === current
        ? current
        : { ...next, selectedVehicleId: null, operation: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartParkingJamSession(current.session),
      );
      return next === current
        ? current
        : { ...next, selectedVehicleId: null, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createParkingJamSession(current.session.problem, startedAt),
      ),
      selectedVehicleId: null,
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
    const sessionResult = getParkingJamSessionResult(session);
    return sessionResult
      ? createParkingJamResult(sessionResult, speedReference)
      : null;
  }, [session, speedReference]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board: session.problem.board,
    state: session.puzzleState,
    selectedVehicleId: play.selectedVehicleId,
    operation: play.operation,
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoParkingJamSession(session),
    canRestart: canRestartParkingJamSession(session),
    selectVehicle,
    attemptMove,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}

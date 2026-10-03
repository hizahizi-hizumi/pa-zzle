import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamRestoredProblem } from "@/games/parking-jam/problem/generator";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { selectParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import {
  createParkingJamInitialState,
  type ParkingJamBoard,
  type ParkingJamDirection,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { listParkingJamLegalMoves } from "@/games/parking-jam/puzzle/rules";
import {
  calculateParkingJamPlayScore,
  calculateParkingJamSpeedFullScoreMs,
  type ParkingJamPlayScore,
  type ParkingJamSpeedReference,
} from "@/games/parking-jam/score";
import {
  attemptParkingJamSessionMove,
  canRestartParkingJamSession,
  canUndoParkingJamSession,
  createParkingJamSession,
  getParkingJamSessionElapsedMs,
  getParkingJamSessionResult,
  type ParkingJamSession,
  type ParkingJamSessionResult,
  restartParkingJamSession,
  undoParkingJamSession,
} from "@/games/parking-jam/session/session";
import type { ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";

export type ParkingJamOperation = {
  id: number;
  type: "blocked" | "exited";
  vehicleId: ParkingJamVehicleId;
  direction: ParkingJamDirection;
};

export type ParkingJamProgress = "playing" | "clearing" | "result";

export type ParkingJamResult = ParkingJamSessionResult & {
  problemIdentity: ParkingJamProblemIdentity;
  speedReference: ParkingJamSpeedReference;
  speedFullScoreMs: number;
  score: ParkingJamPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createParkingJamResult(
  sessionResult: ParkingJamSessionResult,
  problemIdentity: ParkingJamProblemIdentity,
  speedReference: ParkingJamSpeedReference,
): ParkingJamResult {
  const speedFullScoreMs = calculateParkingJamSpeedFullScoreMs(speedReference);
  return {
    ...sessionResult,
    problemIdentity,
    speedReference,
    speedFullScoreMs,
    score: calculateParkingJamPlayScore({
      speedFullScoreMs,
      elapsedMs: sessionResult.elapsedMs,
      failedMoveCount: sessionResult.failedMoveCount,
      undoCount: sessionResult.undoCount,
      restartCount: sessionResult.restartCount,
    }),
  };
}

type ParkingJamPlayState = {
  session: ParkingJamSession;
  problemIdentity: ParkingJamProblemIdentity;
  speedReference: ParkingJamSpeedReference;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  progress: ParkingJamProgress;
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
  difficulty: ParkingJamDifficulty,
  startedAt: number,
  initialProblem?: ParkingJamRestoredProblem,
  avoidedProblemId?: ProblemId,
): ParkingJamPlayState {
  const restored =
    initialProblem ??
    selectProblemAvoiding(
      (seed) => selectParkingJamProblemForDifficulty(difficulty, seed),
      avoidedProblemId,
    ).problem;

  return {
    session: createParkingJamSession(restored.problem, startedAt),
    problemIdentity: restored.identity,
    speedReference: getSpeedReference(restored.problem.board),
    selectedVehicleId: null,
    operation: null,
    progress: "playing",
  };
}

/** `initialProblem` を渡すと、指定された問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useParkingJamPlay(
  difficulty: ParkingJamDifficulty,
  initialProblem?: ParkingJamRestoredProblem,
  avoidedProblemId?: ProblemId,
) {
  const [play, setPlay] = useState<ParkingJamPlayState>(() =>
    createPlayState(difficulty, Date.now(), initialProblem, avoidedProblemId),
  );
  const [now, setNow] = useState(() => Date.now());
  const nextOperationId = useRef(0);

  useEffect(() => {
    if (play.session.status !== "playing") return;

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [play.session.status]);

  const selectVehicle = useCallback((vehicleId: ParkingJamVehicleId) => {
    setPlay((current) => {
      if (
        current.session.status !== "playing" ||
        !current.session.state.remainingVehicleIds.includes(vehicleId)
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
      setNow(attemptedAt);
      setPlay((current) => {
        if (current.session.status !== "playing") {
          return current;
        }

        const attempt = attemptParkingJamSessionMove(
          current.session,
          { vehicleId, direction },
          attemptedAt,
        );
        if (!attempt) return current;

        return {
          ...current,
          session: attempt.session,
          selectedVehicleId:
            attempt.outcome === "exited" ? null : current.selectedVehicleId,
          operation: {
            id: operationId,
            type: attempt.outcome,
            vehicleId,
            direction,
          },
          progress:
            attempt.session.status === "cleared"
              ? "clearing"
              : current.progress,
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setPlay((current) => {
      const session = undoParkingJamSession(current.session);
      if (session === current.session) return current;

      return {
        ...current,
        session,
        selectedVehicleId: null,
        operation: null,
      };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const session = restartParkingJamSession(current.session);
      if (session === current.session) return current;

      return {
        ...current,
        session,
        selectedVehicleId: null,
        operation: null,
        progress: "playing",
      };
    });
  }, []);

  // 不成立・待った・やり直しの計数を捨てて同じ問題を始め直すと採点を回避できるため、
  // 同じ問題の新しいプレイはクリア後だけ始められる。プレイ中は restart を使う。
  const canReplay = play.session.status === "cleared";
  const replay = useCallback(() => {
    if (!canReplay) return;

    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: createParkingJamSession(current.session.problem, startedAt),
      selectedVehicleId: null,
      operation: null,
      progress: "playing",
    }));
  }, [canReplay]);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    const next = createPlayState(difficulty, startedAt);
    setNow(startedAt);
    setPlay(next);
  }, [difficulty]);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.session.status === "cleared" && current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const { session } = play;
  const elapsedMs = getParkingJamSessionElapsedMs(session, now);
  const sessionResult = useMemo(
    () => getParkingJamSessionResult(session, now),
    [now, session],
  );
  const result = useMemo<ParkingJamResult | null>(
    () =>
      sessionResult
        ? createParkingJamResult(
            sessionResult,
            play.problemIdentity,
            play.speedReference,
          )
        : null,
    [play.speedReference, play.problemIdentity, sessionResult],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    board: session.problem.board,
    state: session.state,
    selectedVehicleId: play.selectedVehicleId,
    operation: play.operation,
    elapsedMs,
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoParkingJamSession(session),
    canRestart: canRestartParkingJamSession(session),
    result,
    selectVehicle,
    attemptMove,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}

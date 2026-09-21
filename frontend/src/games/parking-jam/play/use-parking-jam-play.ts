import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { generateParkingJamProblemForDifficulty } from "@/games/parking-jam/problem-selection";
import type {
  ParkingJamDirection,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  calculateParkingJamPlayScore,
  type ParkingJamPlayScore,
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
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";

export type ParkingJamOperation = {
  id: number;
  type: "blocked" | "exited";
  vehicleId: ParkingJamVehicleId;
  direction: ParkingJamDirection;
};

export type ParkingJamProgress = "playing" | "clearing" | "result";

export type ParkingJamResult = ParkingJamSessionResult & {
  problemIdentity: ParkingJamProblemIdentity;
  score: ParkingJamPlayScore;
};

type ParkingJamPlayState = {
  session: ParkingJamSession;
  problemIdentity: ParkingJamProblemIdentity;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  progress: ParkingJamProgress;
};

function createPlayState(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
  startedAt: number,
): ParkingJamPlayState {
  const generated = generateParkingJamProblemForDifficulty(difficulty, seed);

  return {
    session: createParkingJamSession(generated.problem, startedAt),
    problemIdentity: generated.identity,
    difficultyAnalysis: generated.difficultyAnalysis,
    selectedVehicleId: null,
    operation: null,
    progress: "playing",
  };
}

export function useParkingJamPlay(difficulty: ParkingJamDifficulty) {
  const [play, setPlay] = useState<ParkingJamPlayState>(() =>
    createPlayState(difficulty, createProblemSeed(), Date.now()),
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

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: createParkingJamSession(current.session.problem, startedAt),
      selectedVehicleId: null,
      operation: null,
      progress: "playing",
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    const next = createPlayState(difficulty, createProblemSeed(), startedAt);
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
        ? {
            ...sessionResult,
            problemIdentity: play.problemIdentity,
            score: calculateParkingJamPlayScore({
              difficulty,
              elapsedMs: sessionResult.elapsedMs,
              failedMoveCount: sessionResult.failedMoveCount,
              undoCount: sessionResult.undoCount,
              restartCount: sessionResult.restartCount,
            }),
          }
        : null,
    [difficulty, play.problemIdentity, sessionResult],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    difficultyAnalysis: play.difficultyAnalysis,
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

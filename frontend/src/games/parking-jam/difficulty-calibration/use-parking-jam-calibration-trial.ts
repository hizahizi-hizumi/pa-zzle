import { useCallback, useMemo, useRef, useState } from "react";
import {
  type ParkingJamDifficultyCalibrationProblemId,
  restoreParkingJamDifficultyCalibrationProblem,
} from "../difficulty-calibration";
import type { ParkingJamOperation } from "../play/use-parking-jam-play";
import type { ParkingJamDirection, ParkingJamVehicleId } from "../puzzle/board";
import {
  attemptParkingJamSessionMove,
  canRestartParkingJamSession,
  canUndoParkingJamSession,
  createParkingJamSession,
  getParkingJamSessionResult,
  restartParkingJamSession,
  undoParkingJamSession,
} from "../session/session";
import type { ParkingJamCalibrationTrialResult } from "./results";

export function useParkingJamCalibrationTrial(
  problemId: ParkingJamDifficultyCalibrationProblemId,
) {
  const generated = useMemo(
    () => restoreParkingJamDifficultyCalibrationProblem(problemId),
    [problemId],
  );
  const startedAt = useRef(Date.now());
  const firstMoveAt = useRef<number | null>(null);
  const nextOperationId = useRef(0);
  const [session, setSession] = useState(() =>
    createParkingJamSession(generated.problem, startedAt.current),
  );
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<ParkingJamVehicleId | null>(null);
  const [operation, setOperation] = useState<ParkingJamOperation | null>(null);
  const [clearAnimationComplete, setClearAnimationComplete] = useState(false);

  const selectVehicle = useCallback(
    (vehicleId: ParkingJamVehicleId) => {
      if (
        session.status !== "playing" ||
        !session.state.remainingVehicleIds.includes(vehicleId)
      ) {
        return;
      }
      setSelectedVehicleId((selected) =>
        selected === vehicleId ? null : vehicleId,
      );
      setOperation(null);
    },
    [session],
  );

  const attemptMove = useCallback(
    (vehicleId: ParkingJamVehicleId, direction: ParkingJamDirection) => {
      const attemptedAt = Date.now();
      const attempt = attemptParkingJamSessionMove(
        session,
        { vehicleId, direction },
        attemptedAt,
      );
      if (!attempt) return;
      if (firstMoveAt.current === null) firstMoveAt.current = attemptedAt;
      const operationId = nextOperationId.current++;
      setSession(attempt.session);
      setOperation({
        id: operationId,
        type: attempt.outcome,
        vehicleId,
        direction,
      });
      if (attempt.outcome === "exited") setSelectedVehicleId(null);
    },
    [session],
  );

  const undo = useCallback(() => {
    const nextSession = undoParkingJamSession(session);
    if (nextSession === session) return;
    setSession(nextSession);
    setSelectedVehicleId(null);
    setOperation(null);
  }, [session]);

  const restart = useCallback(() => {
    const nextSession = restartParkingJamSession(session);
    if (nextSession === session) return;
    setSession(nextSession);
    setSelectedVehicleId(null);
    setOperation(null);
  }, [session]);

  const completeExitAnimation = useCallback(() => {
    if (session.status === "cleared") setClearAnimationComplete(true);
  }, [session.status]);

  const trialResult = useMemo<ParkingJamCalibrationTrialResult | null>(() => {
    const result = getParkingJamSessionResult(session, Date.now());
    if (!result) return null;
    return {
      problemId,
      elapsedMs: result.elapsedMs,
      firstMoveMs:
        firstMoveAt.current === null
          ? null
          : firstMoveAt.current - session.startedAt,
      failedMoveCount: result.failedMoveCount,
      undoCount: result.undoCount,
      restartCount: result.restartCount,
    };
  }, [problemId, session]);

  return {
    board: session.problem.board,
    state: session.state,
    selectedVehicleId,
    operation,
    canUndo: canUndoParkingJamSession(session),
    canRestart: canRestartParkingJamSession(session),
    cleared: session.status === "cleared" && clearAnimationComplete,
    result: trialResult,
    selectVehicle,
    attemptMove,
    undo,
    restart,
    completeExitAnimation,
  };
}

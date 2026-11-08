import { useEffect, useRef, useState } from "react";
import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type {
  ParkingJamOperation,
  ParkingJamResult,
} from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamMove,
  ParkingJamState,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  ParkingJamBoard,
  type ParkingJamBoardConcept,
} from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamPlanControls } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamPlanControls";
import { ParkingJamExperiencePicker } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamExperiencePicker";
import { useParkingJamSoundEffects } from "@/games/parking-jam/ui/ParkingJamPlay/use-parking-jam-sound-effects";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/result/ParkingJamResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type ParkingJamPlayProps = GamePlayScreenProps<
  ParkingJamDifficulty,
  ParkingJamResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: ParkingJamBoardDefinition;
    state: ParkingJamState;
    selectedVehicleId: ParkingJamVehicleId | null;
    operation: ParkingJamOperation | null;
    failedMoveCount: number;
    undoCount: number;
    onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
    onMove: (
      vehicleId: ParkingJamVehicleId,
      direction: ParkingJamDirection,
    ) => void;
  };

export function ParkingJamPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  state,
  selectedVehicleId,
  operation,
  failedMoveCount,
  undoCount,
  canUndo,
  canRestart,
  onSelectVehicle,
  onMove,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: ParkingJamPlayProps) {
  useParkingJamSoundEffects(operation, progress);
  const [concept, setConcept] = useState<ParkingJamBoardConcept>("original");
  const [plan, setPlan] = useState<ParkingJamMove[]>([]);
  const [executing, setExecuting] = useState(false);
  const planExecution = useRef(0);
  useEffect(() => () => { planExecution.current += 1; }, []);

  function changeConcept(next: ParkingJamBoardConcept) {
    planExecution.current += 1;
    setExecuting(false);
    setPlan([]);
    setConcept(next);
  }

  function enqueueMove(vehicleId: string, direction: ParkingJamDirection) {
    if (executing || !state.remainingVehicleIds.includes(vehicleId)) return;
    setPlan((current) =>
      current.length >= 6 || current.some((move) => move.vehicleId === vehicleId)
        ? current
        : [...current, { vehicleId, direction }],
    );
  }

  async function executePlan() {
    if (executing || plan.length === 0) return;
    const executionId = ++planExecution.current;
    setExecuting(true);
    const moves = [...plan];
    setPlan([]);
    for (const move of moves) {
      if (executionId !== planExecution.current) return;
      onMove(move.vehicleId, move.direction);
      await new Promise<void>((resolve) => setTimeout(resolve, 680));
    }
    if (executionId === planExecution.current) setExecuting(false);
  }
  const comparing =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("parkingJamLab");

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={PARKING_JAM_DISPLAY_NAME}
      background={
        <div
          className="size-full bg-[#e2e5e4] dark:bg-[#22282a]"
        />
      }
      metrics={[
        { type: "count", label: "ミス", count: failedMoveCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ParkingJamHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <ParkingJamResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-6">
        <ParkingJamBoard
          board={board}
          concept={comparing ? concept : "original"}
          plannedMoves={comparing && concept === "plan" ? plan : []}
          state={state}
          selectedVehicleId={selectedVehicleId}
          operation={operation}
          interactionDisabled={progress !== "playing"}
          clearing={progress === "clearing"}
          onSelectVehicle={onSelectVehicle}
          onMove={comparing && concept === "plan" ? enqueueMove : onMove}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
      <footer
        className={
          comparing
            ? "grid h-40 shrink-0 content-center justify-items-center gap-2 px-4 pb-2"
            : "grid h-28 shrink-0 items-end px-4 pb-2"
        }
      >
        {comparing ? (
          <ParkingJamExperiencePicker concept={concept} onChange={changeConcept} />
        ) : null}
        {comparing && concept === "plan" ? (
          <ParkingJamPlanControls
            moves={plan}
            executing={executing}
            onExecute={executePlan}
            onUndoPlan={() => setPlan((current) => current.slice(0, -1))}
            onClearPlan={() => setPlan([])}
          />
        ) : null}
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}

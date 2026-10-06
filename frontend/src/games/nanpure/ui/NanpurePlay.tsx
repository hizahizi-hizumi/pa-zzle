import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import type {
  NanpureBoard as NanpureBoardState,
  NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureInputPanel } from "@/games/nanpure/ui/play/NanpureInputPanel";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type NanpurePlayProps = GamePlayScreenProps<NanpureDifficulty, NanpureResult> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    clues: NanpureBoardState;
    board: NanpureBoardState;
    notes: NanpureNotes;
    selectedCellIndex: number | null;
    conflictCellIndices: readonly number[];
    mistakeCellIndices: readonly number[];
    completedDigits: readonly NanpureDigit[];
    notesMode: boolean;
    mistakeCount: number;
    undoCount: number;
    onSelectCell: (cellIndex: number) => void;
    onInputDigit: (digit: NanpureDigit) => void;
    onErase: () => void;
    onToggleNotesMode: () => void;
    onClearAnimationComplete: () => void;
  };

export function NanpurePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  clues,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  completedDigits,
  notesMode,
  mistakeCount,
  undoCount,
  canUndo,
  onSelectCell,
  onInputDigit,
  onErase,
  onToggleNotesMode,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: NanpurePlayProps) {
  const interactionEnabled = progress === "playing";
  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const selectedHasNotes =
    selectedCellIndex !== null && (notes[selectedCellIndex]?.length ?? 0) > 0;

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={NANPURE_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "ミス", count: mistakeCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: "待った", count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <NanpureHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <NanpureResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3">
        <NanpureClearAnimation
          active={progress === "clearing"}
          onComplete={onClearAnimationComplete}
        >
          <NanpureBoard
            board={board}
            clues={clues}
            notes={notes}
            selectedCellIndex={selectedCellIndex}
            conflictCellIndices={conflictCellIndices}
            mistakeCellIndices={mistakeCellIndices}
            interactionDisabled={!interactionEnabled}
            onSelectCell={onSelectCell}
          />
        </NanpureClearAnimation>
      </main>

      <NanpureInputPanel
        notesMode={notesMode}
        interactionEnabled={interactionEnabled}
        selectedIsEditable={selectedIsEditable}
        selectedHasAnswer={selectedHasAnswer}
        selectedHasNotes={selectedHasNotes}
        completedDigits={completedDigits}
        canUndo={canUndo}
        onUndo={onUndo}
        onErase={onErase}
        onToggleNotesMode={onToggleNotesMode}
        onInputDigit={onInputDigit}
      />
    </GamePlayFrame>
  );
}

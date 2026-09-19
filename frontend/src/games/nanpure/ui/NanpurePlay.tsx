import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { NanpureDifficulty } from "@/games/nanpure/game/difficulty";
import type { NanpureNotes } from "@/games/nanpure/game/session";
import type {
  NanpureBoard as NanpureBoardState,
  NanpureDigit,
} from "@/games/nanpure/game/state";
import type {
  NanpureProgress,
  NanpureResult,
} from "@/games/nanpure/hooks/use-nanpure-game";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { NanpureInputPanel } from "@/games/nanpure/ui/play/NanpureInputPanel";
import { NanpurePlayHeader } from "@/games/nanpure/ui/play/NanpurePlayHeader";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";
import type { PlayRecordSaveOutcome } from "@/records/presentation";

type NanpurePlayProps = {
  difficulty: NanpureDifficulty;
  status: "playing" | "cleared";
  progress: NanpureProgress;
  clues: NanpureBoardState;
  board: NanpureBoardState;
  notes: NanpureNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  completedDigits: readonly NanpureDigit[];
  notesMode: boolean;
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
  canUndo: boolean;
  result: NanpureResult | null;
  recordOutcome: PlayRecordSaveOutcome | null;
  selectCell: (cellIndex: number) => void;
  inputDigit: (digit: NanpureDigit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
  undo: () => void;
  restart: () => void;
  replay: () => void;
  newGame: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  completeClearAnimation: () => void;
};

export function NanpurePlay({
  status,
  progress,
  clues,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  completedDigits,
  notesMode,
  elapsedMs,
  mistakeCount,
  undoCount,
  canUndo,
  result,
  recordOutcome,
  selectCell,
  inputDigit,
  erase,
  toggleNotesMode,
  undo,
  restart,
  replay,
  newGame,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  completeClearAnimation,
}: NanpurePlayProps) {
  if (progress === "result" && status === "cleared" && result) {
    return (
      <NanpureResultScreen
        result={result}
        recordOutcome={recordOutcome}
        replay={replay}
        newGame={newGame}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    );
  }

  const interactionEnabled = status === "playing" && progress === "playing";
  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const selectedHasNotes =
    selectedCellIndex !== null && (notes[selectedCellIndex]?.length ?? 0) > 0;

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <NanpurePlayHeader
        elapsedMs={elapsedMs}
        mistakeCount={mistakeCount}
        undoCount={undoCount}
        restart={restart}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />

      <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3">
        <NanpureClearAnimation
          active={progress === "clearing"}
          onComplete={completeClearAnimation}
        >
          <NanpureBoard
            board={board}
            clues={clues}
            notes={notes}
            selectedCellIndex={selectedCellIndex}
            conflictCellIndices={conflictCellIndices}
            mistakeCellIndices={mistakeCellIndices}
            interactionDisabled={!interactionEnabled}
            onSelectCell={selectCell}
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
        onUndo={undo}
        onErase={erase}
        onToggleNotesMode={toggleNotesMode}
        onInputDigit={inputDigit}
      />
    </section>
  );
}

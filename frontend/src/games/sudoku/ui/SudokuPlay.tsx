import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { SudokuDifficulty } from "@/games/sudoku/game/difficulty";
import type { SudokuNotes } from "@/games/sudoku/game/session";
import type {
  SudokuBoard as SudokuBoardState,
  SudokuDigit,
} from "@/games/sudoku/game/state";
import type {
  SudokuProgress,
  SudokuResult,
} from "@/games/sudoku/hooks/use-sudoku-game";
import { SudokuClearAnimation } from "@/games/sudoku/ui/board/clear/SudokuClearAnimation";
import { SudokuBoard } from "@/games/sudoku/ui/board/SudokuBoard";
import { SudokuInputPanel } from "@/games/sudoku/ui/play/SudokuInputPanel";
import { SudokuPlayHeader } from "@/games/sudoku/ui/play/SudokuPlayHeader";
import { SudokuResultScreen } from "@/games/sudoku/ui/result/SudokuResultScreen";

type SudokuPlayProps = {
  difficulty: SudokuDifficulty;
  status: "playing" | "cleared";
  progress: SudokuProgress;
  clues: SudokuBoardState;
  board: SudokuBoardState;
  notes: SudokuNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  completedDigits: readonly SudokuDigit[];
  notesMode: boolean;
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
  canUndo: boolean;
  result: SudokuResult | null;
  selectCell: (cellIndex: number) => void;
  inputDigit: (digit: SudokuDigit) => void;
  erase: () => void;
  toggleNotesMode: () => void;
  undo: () => void;
  restart: () => void;
  replay: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  completeClearAnimation: () => void;
};

export function SudokuPlay({
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
  selectCell,
  inputDigit,
  erase,
  toggleNotesMode,
  undo,
  restart,
  replay,
  newGame,
  onChangeDifficulty,
  onBackToHome,
  completeClearAnimation,
}: SudokuPlayProps) {
  if (progress === "result" && status === "cleared" && result) {
    return (
      <SudokuResultScreen
        result={result}
        replay={replay}
        newGame={newGame}
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
      <SudokuPlayHeader
        elapsedMs={elapsedMs}
        mistakeCount={mistakeCount}
        undoCount={undoCount}
        restart={restart}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />

      <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3">
        <SudokuClearAnimation
          active={progress === "clearing"}
          onComplete={completeClearAnimation}
        >
          <SudokuBoard
            board={board}
            clues={clues}
            notes={notes}
            selectedCellIndex={selectedCellIndex}
            conflictCellIndices={conflictCellIndices}
            mistakeCellIndices={mistakeCellIndices}
            interactionDisabled={!interactionEnabled}
            onSelectCell={selectCell}
          />
        </SudokuClearAnimation>
      </main>

      <SudokuInputPanel
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

import type { SudokuNotes } from "@/games/sudoku/game/session";
import {
  getSudokuBlockIndex,
  getSudokuColumnIndex,
  getSudokuRowIndex,
  SUDOKU_DIGITS,
  SUDOKU_SIZE,
  type SudokuBoard as SudokuBoardState,
} from "@/games/sudoku/game/state";
import { cn } from "@/lib/utils";

const SUDOKU_CELL_INDICES = Array.from(
  { length: SUDOKU_SIZE * SUDOKU_SIZE },
  (_, cellIndex) => cellIndex,
);

type SudokuBoardProps = {
  board: SudokuBoardState;
  clues: SudokuBoardState;
  notes: SudokuNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  onSelectCell: (cellIndex: number) => void;
};

function isRelatedCell(left: number, right: number): boolean {
  return (
    getSudokuRowIndex(left) === getSudokuRowIndex(right) ||
    getSudokuColumnIndex(left) === getSudokuColumnIndex(right) ||
    getSudokuBlockIndex(left) === getSudokuBlockIndex(right)
  );
}

function getCellLabel(
  board: SudokuBoardState,
  clues: SudokuBoardState,
  notes: SudokuNotes,
  cellIndex: number,
): string {
  const row = getSudokuRowIndex(cellIndex) + 1;
  const column = getSudokuColumnIndex(cellIndex) + 1;
  const value = board[cellIndex];
  const prefix = `${row}行${column}列`;

  if (value !== null && value !== undefined) {
    return `${prefix}、${value}${clues[cellIndex] === null ? "" : "、初期ヒント"}`;
  }

  const cellNotes = notes[cellIndex] ?? [];
  return cellNotes.length > 0
    ? `${prefix}、空き、メモ ${cellNotes.join("、")}`
    : `${prefix}、空き`;
}

export function SudokuBoard({
  board,
  clues,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  onSelectCell,
}: SudokuBoardProps) {
  const conflictCells = new Set(conflictCellIndices);
  const selectedValue =
    selectedCellIndex === null ? null : (board[selectedCellIndex] ?? null);

  return (
    <div className="grid aspect-square w-[min(96vw,calc(100svh-12rem),38rem)] grid-cols-9 bg-background">
      {SUDOKU_CELL_INDICES.map((cellIndex) => {
        const value = board[cellIndex] ?? null;
        const row = getSudokuRowIndex(cellIndex);
        const column = getSudokuColumnIndex(cellIndex);
        const selected = selectedCellIndex === cellIndex;
        const related =
          selectedCellIndex !== null &&
          !selected &&
          isRelatedCell(selectedCellIndex, cellIndex);
        const matching =
          selectedValue !== null && !selected && value === selectedValue;
        const clue = clues[cellIndex] !== null;
        const conflict = conflictCells.has(cellIndex);
        const cellNotes = notes[cellIndex] ?? [];

        return (
          <button
            key={cellIndex}
            type="button"
            aria-label={getCellLabel(board, clues, notes, cellIndex)}
            aria-pressed={selected}
            aria-invalid={conflict || undefined}
            className={cn(
              "relative flex aspect-square min-h-0 items-center justify-center border-t border-l border-border text-[clamp(1rem,5vw,2rem)] outline-none transition-colors focus-visible:bg-brand-subtle dark:focus-visible:bg-brand/25",
              row % 3 === 0 && "border-t-2 border-t-foreground/55",
              column % 3 === 0 && "border-l-2 border-l-foreground/55",
              row === SUDOKU_SIZE - 1 && "border-b-2 border-b-foreground/55",
              column === SUDOKU_SIZE - 1 && "border-r-2 border-r-foreground/55",
              related && "bg-brand-subtle/55 dark:bg-brand-subtle/10",
              matching && "bg-brand-subtle dark:bg-brand/25",
              selected && "bg-brand dark:bg-brand-strong/45",
              clue && "font-semibold text-foreground",
              !clue &&
                value !== null &&
                "font-medium text-brand-foreground dark:text-brand",
              conflict &&
                "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300",
            )}
            onClick={() => onSelectCell(cellIndex)}
          >
            {value ?? (
              <span
                aria-hidden="true"
                className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center text-[clamp(0.42rem,1.8vw,0.72rem)] leading-none font-medium text-brand-foreground/75 dark:text-brand/75"
              >
                {SUDOKU_DIGITS.map((digit) => (
                  <span key={digit}>
                    {cellNotes.includes(digit) ? digit : ""}
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

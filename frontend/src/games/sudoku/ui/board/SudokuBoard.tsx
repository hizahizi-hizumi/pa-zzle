import type { SudokuNotes } from "@/games/sudoku/game/session";
import {
  areSudokuCellsRelated,
  SUDOKU_SIZE,
  type SudokuBoard as SudokuBoardState,
} from "@/games/sudoku/game/state";

import { SudokuCell } from "./SudokuCell";

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
  mistakeCellIndices: readonly number[];
  interactionDisabled?: boolean;
  onSelectCell: (cellIndex: number) => void;
};

export function SudokuBoard({
  board,
  clues,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  interactionDisabled = false,
  onSelectCell,
}: SudokuBoardProps) {
  const conflictCells = new Set(conflictCellIndices);
  const mistakeCells = new Set(mistakeCellIndices);
  const selectedValue =
    selectedCellIndex === null ? null : (board[selectedCellIndex] ?? null);

  return (
    <div className="grid aspect-square w-[min(96vw,calc(100svh-12rem),38rem)] grid-cols-9 overflow-hidden border-2 border-foreground/55 bg-background">
      {SUDOKU_CELL_INDICES.map((cellIndex) => {
        const value = board[cellIndex] ?? null;
        const selected = selectedCellIndex === cellIndex;
        const related =
          selectedCellIndex !== null &&
          !selected &&
          areSudokuCellsRelated(selectedCellIndex, cellIndex);

        return (
          <SudokuCell
            key={cellIndex}
            cellIndex={cellIndex}
            value={value}
            clue={clues[cellIndex] !== null}
            notes={notes[cellIndex] ?? []}
            selectedValue={selectedValue}
            selected={selected}
            related={related}
            matching={
              selectedValue !== null && !selected && value === selectedValue
            }
            conflict={conflictCells.has(cellIndex)}
            mistake={mistakeCells.has(cellIndex)}
            disabled={interactionDisabled}
            onSelect={onSelectCell}
          />
        );
      })}
    </div>
  );
}

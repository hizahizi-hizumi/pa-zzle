import {
  areNanpureCellsRelated,
  NANPURE_SIZE,
  type NanpureBoard as NanpureBoardState,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";

import { NanpureCell } from "@/games/nanpure/ui/board/NanpureCell";
import { cn } from "@/lib/utils";

const NANPURE_CELL_INDICES = Array.from(
  { length: NANPURE_SIZE * NANPURE_SIZE },
  (_, cellIndex) => cellIndex,
);

type NanpureBoardProps = {
  board: NanpureBoardState;
  clues: NanpureBoardState;
  notes: NanpureNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  interactionDisabled?: boolean;
  /** 盤面の幅。渡さなければ、プレイ画面に合わせて画面の幅と高さから決める。 */
  sizeClassName?: string;
  onSelectCell: (cellIndex: number) => void;
};

export function NanpureBoard({
  board,
  clues,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  interactionDisabled = false,
  sizeClassName = "w-[min(96vw,calc(100svh-12rem),38rem)]",
  onSelectCell,
}: NanpureBoardProps) {
  const conflictCells = new Set(conflictCellIndices);
  const mistakeCells = new Set(mistakeCellIndices);
  const selectedValue =
    selectedCellIndex === null ? null : (board[selectedCellIndex] ?? null);

  return (
    <div
      className={cn(
        "grid aspect-square grid-cols-9 overflow-hidden border-2 border-foreground/55 bg-background",
        sizeClassName,
      )}
    >
      {NANPURE_CELL_INDICES.map((cellIndex) => {
        const value = board[cellIndex] ?? null;
        const selected = selectedCellIndex === cellIndex;
        const related =
          selectedCellIndex !== null &&
          !selected &&
          areNanpureCellsRelated(selectedCellIndex, cellIndex);

        return (
          <NanpureCell
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

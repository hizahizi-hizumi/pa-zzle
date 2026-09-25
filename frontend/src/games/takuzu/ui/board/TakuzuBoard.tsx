import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuCell } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell";

type TakuzuBoardProps = {
  size: number;
  cells: readonly TakuzuCellView[];
  disabled: boolean;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
};

function getCellKey(size: number, cellIndex: number): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  return `${row}:${column}`;
}

export function TakuzuBoard({
  size,
  cells,
  disabled,
  onCycleCell,
}: TakuzuBoardProps) {
  return (
    <div
      role="group"
      aria-label="盤面"
      className="grid aspect-square w-full max-w-[28rem] gap-1 rounded-lg bg-slate-300 p-1 dark:bg-slate-700"
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
      }}
    >
      {cells.map(function renderCell(view, cellIndex) {
        return (
          <TakuzuCell
            key={getCellKey(size, cellIndex)}
            size={size}
            cellIndex={cellIndex}
            view={view}
            disabled={disabled}
            onCycle={onCycleCell}
          />
        );
      })}
    </div>
  );
}

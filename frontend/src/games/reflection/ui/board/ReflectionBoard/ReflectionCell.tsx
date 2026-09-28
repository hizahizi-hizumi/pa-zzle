import {
  getReflectionCellPosition,
  type ReflectionCell as ReflectionCellState,
} from "@/games/reflection/puzzle/board";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { cn } from "@/lib/utils";

type ReflectionCellProps = {
  size: number;
  cellIndex: number;
  cell: ReflectionCellState;
  selected: boolean;
  disabled: boolean;
  onTap: (cellIndex: number) => void;
};

export function ReflectionCell({
  size,
  cellIndex,
  cell,
  selected,
  disabled,
  onTap,
}: ReflectionCellProps) {
  const { row, column } = getReflectionCellPosition(size, cellIndex);
  const content = cell === null ? "空き" : reflectionPieceLabels[cell];

  return (
    <button
      type="button"
      aria-label={`${row + 1}行${column + 1}列 ${content}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onTap(cellIndex)}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center bg-background text-foreground outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default aria-pressed:bg-violet-100 dark:aria-pressed:bg-violet-950/70",
        row !== size - 1 && "border-b border-b-border",
        column !== size - 1 && "border-r border-r-border",
      )}
    >
      {cell !== null ? <ReflectionPieceIcon piece={cell} size="cell" /> : null}
    </button>
  );
}

import { useCallback } from "react";

import {
  getReflectionCellPosition,
  type ReflectionCell as ReflectionCellState,
} from "@/games/reflection/puzzle/board";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionCellProps = {
  size: number;
  cellIndex: number;
  cell: ReflectionCellState;
  selected: boolean;
  disabled: boolean;
  focusable: boolean;
  onElementChange: (key: string, element: HTMLButtonElement | null) => void;
  onTap: (cellIndex: number) => void;
  onFocus: (key: string) => void;
  focusKey: string;
};

export function ReflectionCell({
  size,
  cellIndex,
  cell,
  selected,
  disabled,
  focusable,
  onElementChange,
  onTap,
  onFocus,
  focusKey,
}: ReflectionCellProps) {
  const { row, column } = getReflectionCellPosition(size, cellIndex);
  const content = cell === null ? "空き" : reflectionPieceLabels[cell];
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(focusKey, element),
    [focusKey, onElementChange],
  );

  return (
    // 光路をマスの下に描くため、マスの地は透明にし、盤面の地は盤面の枠が持つ。
    <button
      ref={buttonRef}
      type="button"
      aria-label={`${row + 1}行${column + 1}列 ${content}`}
      aria-pressed={selected}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onTap(cellIndex)}
      onFocus={() => onFocus(focusKey)}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center text-foreground outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default enabled:hover:bg-accent/50 enabled:active:bg-accent",
        row !== size - 1 && "border-b border-b-border",
        column !== size - 1 && "border-r border-r-border",
        selected && reflectionToneClassNames.selectionSurface,
      )}
    >
      {cell !== null ? (
        <ReflectionPieceIcon key={cell} piece={cell} size="cell" appearing />
      ) : null}
    </button>
  );
}

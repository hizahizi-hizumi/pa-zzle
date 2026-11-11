import { useCallback } from "react";

import type { TapHandlers } from "@/components/touch-tap";
import {
  getReflectionCellPosition,
  type ReflectionCell as ReflectionCellState,
} from "@/games/reflection/puzzle/board";
import type { ReflectionCue } from "@/games/reflection/ui/board/cue";
import { ReflectionCueLayer } from "@/games/reflection/ui/board/ReflectionCueLayer";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";
import { reflectionPieceToneClassNames } from "@/games/reflection/ui/reflection-tone";
import type { ReflectionDragHandlers } from "@/games/reflection/ui/use-reflection-drag";

/**
 * 選んだピースのマスの四隅に置く鉤形の印。ピースの色（`currentColor`）で描き、マスの地や枠は変えない。
 * 線幅は2px、各辺の長さはマスの28%。
 */
const SELECTION_CORNERS =
  "linear-gradient(currentColor,currentColor) top left/28% 2px no-repeat,linear-gradient(currentColor,currentColor) top left/2px 28% no-repeat,linear-gradient(currentColor,currentColor) top right/28% 2px no-repeat,linear-gradient(currentColor,currentColor) top right/2px 28% no-repeat,linear-gradient(currentColor,currentColor) bottom left/28% 2px no-repeat,linear-gradient(currentColor,currentColor) bottom left/2px 28% no-repeat,linear-gradient(currentColor,currentColor) bottom right/28% 2px no-repeat,linear-gradient(currentColor,currentColor) bottom right/2px 28% no-repeat";

import { cn } from "@/lib/utils";

type ReflectionCellProps = {
  size: number;
  cellIndex: number;
  cell: ReflectionCellState;
  selected: boolean;
  disabled: boolean;
  dragHandlers?: ReflectionDragHandlers;
  dragTarget?: boolean;
  dragging?: boolean;
  illuminated?: boolean;
  absorbing?: boolean;
  focusable: boolean;
  onElementChange: (key: string, element: HTMLButtonElement | null) => void;
  /** 押したときの受け口。タッチは押した位置のマスで受ける（`useTouchTap`）。 */
  selectHandlers: TapHandlers;
  onFocus: (key: string) => void;
  focusKey: string;
  /** このマスに重ねる、チュートリアルの印・応え・覆いから抜く所。 */
  cues?: readonly ReflectionCue[];
};

export function ReflectionCell({
  size,
  cellIndex,
  cell,
  selected,
  disabled,
  dragHandlers,
  dragTarget,
  dragging,
  illuminated,
  absorbing,
  focusable,
  onElementChange,
  selectHandlers,
  onFocus,
  focusKey,
  cues = [],
}: ReflectionCellProps) {
  const { row, column } = getReflectionCellPosition(size, cellIndex);
  const content = cell === null ? "空き" : reflectionPieceLabels[cell];
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(focusKey, element),
    [focusKey, onElementChange],
  );

  return (
    // 光路をマスの下に描くため、マスは地も罫線も持たない。どちらも盤面が光路より下の層に描く。
    <button
      ref={buttonRef}
      type="button"
      aria-label={`${row + 1}行${column + 1}列 ${content}`}
      aria-pressed={selected}
      data-reflection-cell-index={cellIndex}
      data-drag-target={dragTarget ? "" : undefined}
      data-drag-origin={dragging ? "" : undefined}
      data-laser-hit={illuminated ? "" : undefined}
      data-laser-absorbed={absorbing ? "" : undefined}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onPointerDown={dragHandlers?.onPointerDown}
      onPointerMove={dragHandlers?.onPointerMove}
      onPointerUp={(event) => {
        if (!dragHandlers?.onPointerUp(event))
          selectHandlers.onPointerUp(event);
      }}
      onPointerCancel={dragHandlers?.onPointerCancel}
      onClick={(event) => {
        if (!dragHandlers?.onClick(event)) selectHandlers.onClick(event);
      }}
      onFocus={() => onFocus(focusKey)}
      className={cn(
        "reflection-cell relative flex min-h-0 min-w-0 select-none items-center justify-center text-foreground outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default enabled:hover:bg-accent/50 enabled:active:bg-accent",
        dragHandlers ? "touch-none" : "touch-manipulation",
      )}
    >
      <ReflectionCueLayer cues={cues} place="cell" />
      {selected && cell !== null ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-[10%]",
            reflectionPieceToneClassNames[cell],
          )}
          data-selection-mark=""
          style={{ background: SELECTION_CORNERS }}
        />
      ) : null}
      {cell !== null ? (
        <ReflectionPieceIcon key={cell} piece={cell} size="cell" appearing />
      ) : null}
    </button>
  );
}

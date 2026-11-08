import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
  type MinesweeperVisualStyle,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

const LONG_PRESS_DELAY_MS = 450;

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
  visualStyle?: MinesweeperVisualStyle;
  onPress: (cellIndex: number) => void;
  onFlagPress: (cellIndex: number) => void;
};

function getAccessibleName(
  cellIndex: number,
  view: MinesweeperVisibleCell,
): string {
  const position = `マス ${cellIndex + 1}`;
  if (view.state === "flagged") {
    return `${position} 旗`;
  }
  if (view.state === "revealed") {
    return view.adjacentMineCount === 0
      ? `${position} 開示済み 空白`
      : `${position} 開示済み ${view.adjacentMineCount}`;
  }
  if (view.state === "mine") {
    return `${position} 地雷`;
  }
  if (view.state === "steppedMine") {
    return `${position} 踏んだ地雷`;
  }
  return `${position} 未開示`;
}

function getCellClassName(
  view: MinesweeperVisibleCell,
  visualStyle: MinesweeperVisualStyle,
): string {
  const faceClassName = getMinesweeperCellFaceClassName(
    view,
    "board",
    visualStyle,
  );
  const interactionClassName =
    "min-w-0 touch-manipulation select-none outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

  if (view.state === "hidden" || view.state === "flagged") {
    const feedbackClassName =
      visualStyle === "classic"
        ? "transition-colors duration-(--duration-fast) hover:bg-slate-300 dark:hover:bg-slate-600"
        : visualStyle === "hybrid"
          ? "transition-[filter] duration-75 hover:brightness-[1.015] active:brightness-[0.95]"
          : "transition-[filter,transform] duration-(--duration-fast) hover:brightness-105 active:translate-y-[3px] active:brightness-95";
    return `${faceClassName} ${interactionClassName} ${feedbackClassName}`;
  }
  return `${faceClassName} ${interactionClassName}`;
}

export function MinesweeperCell({
  cellIndex,
  view,
  disabled,
  visualStyle = "classic",
  onPress,
  onFlagPress,
}: MinesweeperCellProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  function clearLongPressTimer(): void {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (disabled || event.button !== 0) {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(function handleLongPress() {
      longPressTriggeredRef.current = true;
      onFlagPress(cellIndex);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  }

  function handlePointerEnd(): void {
    clearLongPressTimer();
  }

  function handleClick(): void {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onPress(cellIndex);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    if (!disabled) {
      onFlagPress(cellIndex);
    }
  }

  return (
    <button
      type="button"
      aria-label={getAccessibleName(cellIndex, view)}
      disabled={disabled}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      data-cell-index={cellIndex}
      data-cell-state={view.state}
      className={getCellClassName(view, visualStyle)}
    >
      <MinesweeperCellFace view={view} size="board" visualStyle={visualStyle} />
    </button>
  );
}

import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

const LONG_PRESS_DELAY_MS = 450;

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
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

function getCellClassName(view: MinesweeperVisibleCell): string {
  const faceClassName = getMinesweeperCellFaceClassName(view, "board");
  const interactionClassName =
    "min-w-0 touch-manipulation select-none outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

  if (view.state === "hidden") {
    return `${faceClassName} ${interactionClassName} transition-[filter] duration-75 hover:brightness-[1.015] active:brightness-[0.95]`;
  }
  return `${faceClassName} ${interactionClassName}`;
}

export function MinesweeperCell({
  cellIndex,
  view,
  disabled,
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
    if (disabled) {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    if (event.button !== 0) {
      return;
    }
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
    if (disabled || longPressTriggeredRef.current) {
      return;
    }
    clearLongPressTimer();
    longPressTriggeredRef.current = true;
    onFlagPress(cellIndex);
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
      className={getCellClassName(view)}
    >
      <MinesweeperCellFace view={view} size="board" />
    </button>
  );
}

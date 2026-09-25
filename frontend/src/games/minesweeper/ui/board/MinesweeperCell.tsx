import { Bomb, Flag } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";

const LONG_PRESS_DELAY_MS = 450;

const NUMBER_CLASS_NAMES = [
  "",
  "text-blue-600 dark:text-blue-400",
  "text-emerald-700 dark:text-emerald-400",
  "text-red-600 dark:text-red-400",
  "text-violet-700 dark:text-violet-400",
  "text-amber-800 dark:text-amber-400",
  "text-cyan-700 dark:text-cyan-400",
  "text-neutral-900 dark:text-neutral-100",
  "text-neutral-500 dark:text-neutral-400",
] as const;

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
  if (view.state === "exploded") {
    return `${position} 踏んだ地雷`;
  }
  return `${position} 未開示`;
}

function getCellClassName(view: MinesweeperVisibleCell): string {
  const base =
    "flex aspect-square min-w-0 touch-manipulation select-none items-center justify-center border-b border-r border-slate-300 font-sans text-[clamp(0.8rem,4vw,1.15rem)] font-bold leading-none outline-none transition-colors duration-fast focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none dark:border-slate-600";

  if (view.state === "exploded") {
    return `${base} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300`;
  }
  if (view.state === "revealed") {
    const numberClassName = NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? "";
    return `${base} bg-background ${numberClassName}`;
  }
  if (view.state === "flagged") {
    return `${base} bg-slate-200 text-red-600 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)] hover:bg-slate-300 dark:bg-slate-700 dark:text-red-400 dark:shadow-none dark:hover:bg-slate-600`;
  }
  if (view.state === "mine") {
    return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`;
  }
  return `${base} bg-slate-200 text-slate-800 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)] hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:shadow-none dark:hover:bg-slate-600`;
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
      className={getCellClassName(view)}
    >
      {view.state === "flagged" && (
        <Flag className="size-[52%] fill-current" aria-hidden />
      )}
      {(view.state === "mine" || view.state === "exploded") && (
        <Bomb className="size-[50%]" aria-hidden />
      )}
      {view.state === "revealed" && view.adjacentMineCount > 0
        ? view.adjacentMineCount
        : null}
    </button>
  );
}

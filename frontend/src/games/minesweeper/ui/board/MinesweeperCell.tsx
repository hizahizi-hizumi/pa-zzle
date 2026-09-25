import { Bomb, Flag } from "lucide-react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
  onPress: (cellIndex: number) => void;
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
  if (view.state === "exploded") {
    return `${position} 地雷`;
  }
  return `${position} 未開示`;
}

export function MinesweeperCell({
  cellIndex,
  view,
  disabled,
  onPress,
}: MinesweeperCellProps) {
  const isRevealed = view.state === "revealed";
  const isExploded = view.state === "exploded";

  return (
    <button
      type="button"
      aria-label={getAccessibleName(cellIndex, view)}
      disabled={disabled}
      onClick={() => onPress(cellIndex)}
      className={`flex aspect-square min-w-0 items-center justify-center border border-border text-[clamp(0.75rem,4vw,1.1rem)] font-sans font-bold leading-none transition-[background-color,transform] duration-fast active:scale-95 disabled:pointer-events-none ${
        isExploded
          ? "bg-destructive text-white"
          : isRevealed
            ? "bg-background text-foreground"
            : "bg-brand-subtle text-brand-foreground hover:bg-accent"
      }`}
    >
      {view.state === "flagged" && <Flag className="size-[55%]" aria-hidden />}
      {view.state === "exploded" && <Bomb className="size-[55%]" aria-hidden />}
      {view.state === "revealed" && view.adjacentMineCount > 0
        ? view.adjacentMineCount
        : null}
    </button>
  );
}

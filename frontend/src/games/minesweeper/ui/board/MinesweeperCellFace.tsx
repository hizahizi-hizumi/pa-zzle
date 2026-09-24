import { Bomb, Flag } from "lucide-react";

import type { MinesweeperVisibleCell } from "../../session/session";

export type MinesweeperCellFaceSize = "board" | "preview";

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

const SIZE_CLASS_NAMES = {
  board: "text-[clamp(0.8rem,4vw,1.15rem)]",
  preview: "text-[11px] tabular-nums lg:text-sm",
} satisfies Record<MinesweeperCellFaceSize, string>;

const MINE_ICON_CLASS_NAMES = {
  board: "size-[50%]",
  preview: "size-[60%]",
} satisfies Record<MinesweeperCellFaceSize, string>;

function getStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "exploded") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  if (view.state === "revealed") {
    return `bg-background ${NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? ""}`;
  }
  if (view.state === "flagged") {
    return "bg-slate-200 text-red-600 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)] dark:bg-slate-700 dark:text-red-400 dark:shadow-none";
  }
  if (view.state === "mine") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
  return "bg-slate-200 text-slate-800 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)] dark:bg-slate-700 dark:text-slate-100 dark:shadow-none";
}

// マスの外枠要素に付ける見た目。操作に関わる見た目は外枠要素の側で足す。
export function getMinesweeperCellFaceClassName(
  view: MinesweeperVisibleCell,
  size: MinesweeperCellFaceSize,
): string {
  return `flex aspect-square items-center justify-center border-b border-r border-slate-300 font-sans font-bold leading-none dark:border-slate-600 ${SIZE_CLASS_NAMES[size]} ${getStateClassName(view)}`;
}

type MinesweeperCellFaceProps = {
  view: MinesweeperVisibleCell;
  size: MinesweeperCellFaceSize;
};

export function MinesweeperCellFace({ view, size }: MinesweeperCellFaceProps) {
  if (view.state === "flagged") {
    return <Flag className="size-[52%] fill-current" aria-hidden />;
  }
  if (view.state === "mine" || view.state === "exploded") {
    return <Bomb className={MINE_ICON_CLASS_NAMES[size]} aria-hidden />;
  }
  if (view.state === "revealed" && view.adjacentMineCount > 0) {
    return view.adjacentMineCount;
  }
  return null;
}

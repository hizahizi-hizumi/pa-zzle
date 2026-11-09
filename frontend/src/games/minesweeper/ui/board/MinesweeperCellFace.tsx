import { Bomb, Flag } from "lucide-react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { RaisedFlag } from "@/games/minesweeper/ui/board/MinesweeperCellFace/RaisedFlag";
import { RaisedMine } from "@/games/minesweeper/ui/board/MinesweeperCellFace/RaisedMine";

/** `board` は盤面のマス、`preview` はゲームのホームのレベルのカードの小さな盤面、`figure` は遊び方の図のマス。 */
export type MinesweeperCellFaceSize = "board" | "preview" | "figure";

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

const BOARD_NUMBER_CLASS_NAMES = [
  "",
  "text-blue-700 dark:text-blue-400",
  "text-emerald-800 dark:text-emerald-400",
  "text-red-800 dark:text-red-400",
  ...NUMBER_CLASS_NAMES.slice(4),
] as const;

const SIZE_CLASS_NAMES = {
  board: "text-[clamp(0.8rem,4vw,1.15rem)]",
  preview: "text-[11px] tabular-nums",
  figure: "text-sm tabular-nums",
} satisfies Record<MinesweeperCellFaceSize, string>;

const MINE_ICON_CLASS_NAMES = {
  board: "size-[50%]",
  preview: "size-[60%]",
  figure: "size-[55%]",
} satisfies Record<MinesweeperCellFaceSize, string>;

function getClassicStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "steppedMine") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300";
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

const BOARD_TILE_SURFACE_CLASS_NAME =
  "bg-[linear-gradient(155deg,#dfe5ee_0%,#d5dde8_100%)] shadow-[inset_0_1px_0_#ffffffef,0_2px_0_#92a0b1,0_3px_4px_#4b5c7529] dark:bg-[linear-gradient(155deg,#56677b_0%,#4d5d72_100%)] dark:shadow-[inset_0_1px_0_#97a7b86c,0_2px_0_#202d3d,0_3px_4px_#050a1388]";

function isRaisedBoardTile(view: MinesweeperVisibleCell): boolean {
  return view.state === "hidden" || view.state === "flagged";
}

/**
 * 盤面のマスが見える形の位置と角丸。マスの中に絶対配置で重ねる。
 * 浮いたマス（開いていない・旗）は、面の下に `BOARD_TILE_SURFACE_CLASS_NAME` の影の `0_2px_0` の縁が見えるので、その分を下へ含める。
 */
export function getMinesweeperBoardCellShapeClassName(
  view: MinesweeperVisibleCell,
): string {
  return isRaisedBoardTile(view)
    ? "inset-x-0 top-0 -bottom-[2px] rounded-[4px]"
    : "inset-0 rounded-[4px]";
}

function getBoardStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "steppedMine") {
    return "bg-rose-200 text-rose-800 shadow-[inset_0_2px_4px_#a65d5d55] dark:bg-rose-900 dark:text-rose-200";
  }
  if (view.state === "revealed") {
    return `bg-[#cbd5df] shadow-[inset_0_1px_2px_#53657b42,inset_0_-1px_0_#ffffff8a] dark:bg-[#2d3947] dark:shadow-[inset_0_2px_4px_#070d1688,inset_0_-1px_0_#74869b2e] ${BOARD_NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? ""}`;
  }
  if (view.state === "flagged") {
    return `${BOARD_TILE_SURFACE_CLASS_NAME} text-red-600 dark:text-red-400`;
  }
  if (view.state === "mine") {
    return "bg-[#e5e9ef] text-slate-700 shadow-[inset_0_2px_3px_#64748b30] dark:bg-[#303c4b] dark:text-slate-200";
  }
  return `${BOARD_TILE_SURFACE_CLASS_NAME} text-slate-800 dark:text-slate-100`;
}

export function getMinesweeperCellFaceClassName(
  view: MinesweeperVisibleCell,
  size: MinesweeperCellFaceSize,
): string {
  const base = `flex aspect-square items-center justify-center font-sans font-bold leading-none ${SIZE_CLASS_NAMES[size]}`;
  if (size === "board") {
    return `${base} rounded-[4px] ${getBoardStateClassName(view)}`;
  }
  return `${base} border-b border-r border-slate-300 dark:border-slate-600 ${getClassicStateClassName(view)}`;
}

type MinesweeperCellFaceProps = {
  view: MinesweeperVisibleCell;
  size: MinesweeperCellFaceSize;
};

export function MinesweeperCellFace({ view, size }: MinesweeperCellFaceProps) {
  if (view.state === "flagged") {
    if (size === "board") return <RaisedFlag />;
    return <Flag className="size-[52%] fill-current" aria-hidden />;
  }
  if (view.state === "mine" || view.state === "steppedMine") {
    if (size === "board") return <RaisedMine />;
    return <Bomb className={MINE_ICON_CLASS_NAMES[size]} aria-hidden />;
  }
  if (view.state === "revealed" && view.adjacentMineCount > 0) {
    return view.adjacentMineCount;
  }
  return null;
}

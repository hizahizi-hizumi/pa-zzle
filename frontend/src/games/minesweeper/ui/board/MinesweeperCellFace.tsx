import { Bomb, Flag } from "lucide-react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";

/** `board` は盤面のマス、`preview` はゲームのホームのレベルのカードの小さな盤面、`figure` は遊び方の図のマス。 */
export type MinesweeperCellFaceSize = "board" | "preview" | "figure";

/** プレイ画面の比較試作用。ホームのプレビューと説明図は既存の描画を保つ。 */
export type MinesweeperVisualStyle = "classic" | "relief" | "hybrid" | "ink";

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

const RELIEF_NUMBER_CLASS_NAMES = [
  "",
  "text-[#315b91] dark:text-[#8fbbf3]",
  "text-[#2b7454] dark:text-[#91c6a0]",
  "text-[#ad5240] dark:text-[#ffab8d]",
  "text-[#74539b] dark:text-[#c7b2e6]",
  "text-[#895c2d] dark:text-[#eac387]",
  "text-[#267987] dark:text-[#a7deec]",
  "text-[#39463d] dark:text-[#e2eade]",
  "text-[#7a817a] dark:text-[#aeb4b0]",
] as const;

const INK_NUMBER_CLASS_NAMES = [
  "",
  "text-[#30618a] dark:text-[#8abbeb]",
  "text-[#32765d] dark:text-[#95d1b2]",
  "text-[#b35445] dark:text-[#f7ad9c]",
  "text-[#74548c] dark:text-[#cca8e3]",
  "text-[#a16b37] dark:text-[#e9c38b]",
  "text-[#257d8f] dark:text-[#89d8e4]",
  "text-[#293e50] dark:text-[#e0e7eb]",
  "text-[#737d88] dark:text-[#9ca7b3]",
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

function getReliefStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "steppedMine") {
    return "bg-[#f0bdab] text-[#863c34] shadow-[inset_0_2px_5px_#965a5030] dark:bg-[#76483f] dark:text-[#ffe0cd]";
  }
  if (view.state === "revealed") {
    return `bg-[#edf0e7] shadow-[inset_0_1px_3px_#4e635521] dark:bg-[#283a33] dark:shadow-[inset_0_1px_4px_#08100b70] ${RELIEF_NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? ""}`;
  }
  if (view.state === "flagged") {
    return "bg-[#b9cbb7] text-[#b64c37] shadow-[inset_0_1px_0_#f2faeb,0_2px_2px_#506b534a] dark:bg-[#466458] dark:text-[#ffa78e] dark:shadow-[inset_0_1px_0_#6e8876,0_2px_2px_#07130b]";
  }
  if (view.state === "mine") {
    return "bg-[#d4dace] text-[#455a4d] shadow-[inset_0_1px_2px_#3d51482a] dark:bg-[#34483e] dark:text-[#bfd0bf]";
  }
  return "bg-[#b9cbb7] text-[#374c3b] shadow-[inset_0_1px_0_#f2faeb,0_2px_2px_#506b534a] dark:bg-[#466458] dark:text-[#dce7d8] dark:shadow-[inset_0_1px_0_#6e8876,0_2px_2px_#07130b]";
}

const HYBRID_TILE_SURFACE_CLASS_NAME =
  "bg-[linear-gradient(155deg,#dfe5ee_0%,#d5dde8_100%)] shadow-[inset_0_1px_0_#ffffffef,0_2px_0_#92a0b1,0_3px_4px_#4b5c7529] dark:bg-[linear-gradient(155deg,#56677b_0%,#4d5d72_100%)] dark:shadow-[inset_0_1px_0_#97a7b86c,0_2px_0_#202d3d,0_3px_4px_#050a1388]";

function getHybridStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "steppedMine") {
    return "bg-rose-200 text-rose-800 shadow-[inset_0_2px_4px_#a65d5d55] dark:bg-rose-900 dark:text-rose-200";
  }
  if (view.state === "revealed") {
    return `bg-[#eff2f6] shadow-[inset_0_2px_4px_#66788f29,inset_0_-1px_0_#ffffff9e] dark:bg-[#2d3947] dark:shadow-[inset_0_2px_4px_#070d1688,inset_0_-1px_0_#74869b2e] ${NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? ""}`;
  }
  if (view.state === "flagged") {
    return `${HYBRID_TILE_SURFACE_CLASS_NAME} text-red-600 dark:text-red-400`;
  }
  if (view.state === "mine") {
    return "bg-[#e5e9ef] text-slate-700 shadow-[inset_0_2px_3px_#64748b30] dark:bg-[#303c4b] dark:text-slate-200";
  }
  return `${HYBRID_TILE_SURFACE_CLASS_NAME} text-slate-800 dark:text-slate-100`;
}

function getInkStateClassName(view: MinesweeperVisibleCell): string {
  if (view.state === "steppedMine") {
    return "bg-[#f2c5b5] text-[#9b4939] dark:bg-[#7b4840] dark:text-[#ffd8c8]";
  }
  if (view.state === "revealed") {
    return `bg-[#f7f6ef] dark:bg-[#222f36] ${INK_NUMBER_CLASS_NAMES[view.adjacentMineCount] ?? ""}`;
  }
  if (view.state === "flagged") {
    return "bg-[#335765] text-[#f8c595] dark:bg-[#547785] dark:text-[#ffd9a5]";
  }
  if (view.state === "mine") {
    return "bg-[#e0e4db] text-[#364c52] dark:bg-[#34454a] dark:text-[#ced9d6]";
  }
  return "bg-[#335765] text-white dark:bg-[#547785] dark:text-white";
}

// マスの外枠要素に付ける見た目。操作に関わる見た目は外枠要素の側で足す。
export function getMinesweeperCellFaceClassName(
  view: MinesweeperVisibleCell,
  size: MinesweeperCellFaceSize,
  visualStyle: MinesweeperVisualStyle = "classic",
): string {
  const base = `flex aspect-square items-center justify-center font-sans font-bold leading-none ${SIZE_CLASS_NAMES[size]}`;
  if (size !== "board" || visualStyle === "classic") {
    return `${base} border-b border-r border-slate-300 dark:border-slate-600 ${getClassicStateClassName(view)}`;
  }
  if (visualStyle === "relief") {
    return `${base} rounded-[3px] ${getReliefStateClassName(view)}`;
  }
  if (visualStyle === "hybrid") {
    return `${base} rounded-[4px] ${getHybridStateClassName(view)}`;
  }
  return `${base} ${getInkStateClassName(view)}`;
}

type MinesweeperCellFaceProps = {
  view: MinesweeperVisibleCell;
  size: MinesweeperCellFaceSize;
  visualStyle?: MinesweeperVisualStyle;
};

/** 盤面の立体感に合わせ、旗は布・支柱・台座を一つの駒として描く。 */
function RaisedFlag() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-[74%] drop-shadow-[0_1px_1px_#0003]"
      aria-hidden="true"
    >
      <path
        d="M10 5v22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M11 6 26 9.5 11 17Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6 27h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 地雷は丸い本体と突起で示し、旗と形を混同させない。 */
function RaisedMine() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-[58%] drop-shadow-[0_1px_1px_#0003]"
      aria-hidden="true"
    >
      <path
        d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l4 4M22 22l4 4M26 6l-4 4M10 22l-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="8.5" fill="currentColor" />
      <circle cx="13" cy="12.5" r="2.1" fill="white" opacity=".55" />
    </svg>
  );
}

export function MinesweeperCellFace({
  view,
  size,
  visualStyle = "classic",
}: MinesweeperCellFaceProps) {
  const raised =
    size === "board" && (visualStyle === "relief" || visualStyle === "hybrid");
  if (view.state === "flagged") {
    if (raised) return <RaisedFlag />;
    return <Flag className="size-[52%] fill-current" aria-hidden />;
  }
  if (view.state === "mine" || view.state === "steppedMine") {
    if (raised) return <RaisedMine />;
    return <Bomb className={MINE_ICON_CLASS_NAMES[size]} aria-hidden />;
  }
  if (view.state === "revealed" && view.adjacentMineCount > 0) {
    return view.adjacentMineCount;
  }
  return null;
}

import type { TakuzuLine } from "@/games/takuzu/puzzle/board";

/**
 * 違反の印は、盤面と遊び方の図で同じ見え方にする。
 * 共通の `error` 色ではなく、盤面の中だけで使うゲーム固有の色にする。
 */

export const runViolationCellClassName = "bg-rose-100/80 dark:bg-rose-950/50";

/** 違反を数や文字で添えるときの色。線の色と同じ系統にする。 */
export const lineViolationTextClassName = "text-rose-500 dark:text-rose-400";

/** 個数超過・重複の行・列の、盤面の縁の外に置く細い線の色。 */
export const lineViolationBarClassName =
  "rounded-full bg-rose-400 dark:bg-rose-400/80";

/** 行・列の端のマスに対して、印を盤面の縁の外へ置く位置。行は左右の外、列は上下の外に置く。 */
export const lineViolationBarPlacementClassNames = {
  row: {
    start: "top-[25%] bottom-[25%] right-[calc(100%+6px)] w-0.5",
    end: "top-[25%] bottom-[25%] left-[calc(100%+6px)] w-0.5",
  },
  column: {
    start: "left-[25%] right-[25%] bottom-[calc(100%+6px)] h-0.5",
    end: "left-[25%] right-[25%] top-[calc(100%+6px)] h-0.5",
  },
} as const satisfies Record<
  TakuzuLine["axis"],
  Record<"start" | "end", string>
>;

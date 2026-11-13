import type { TakuzuCell } from "@/games/takuzu/puzzle/board";

/** 盤面のマスへキーボードで直接置くキーと、置くもの。 */
export type TakuzuPlacementKey = {
  key: string;
  cell: TakuzuCell;
};

/** 盤面の中でフォーカスを動かす矢印キーと、動かす向き。 */
export type TakuzuArrowKeyMove = {
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
  rowOffset: number;
  columnOffset: number;
};

/**
 * キーボードで直接置くキー。盤面の入力と遊び方のキーの表が、この並びをそのまま使う。
 * `1` と `2` は巡回の順（四角 → 丸）に合わせる。
 */
export const takuzuPlacementKeys: readonly TakuzuPlacementKey[] = [
  { key: "1", cell: "a" },
  { key: "2", cell: "b" },
  { key: "0", cell: null },
  { key: "Delete", cell: null },
  { key: "Backspace", cell: null },
];

/** 矢印キー。盤面の入力と遊び方のキーの表が、この並びをそのまま使う。 */
export const takuzuArrowKeys: readonly TakuzuArrowKeyMove[] = [
  { key: "ArrowUp", rowOffset: -1, columnOffset: 0 },
  { key: "ArrowDown", rowOffset: 1, columnOffset: 0 },
  { key: "ArrowLeft", rowOffset: 0, columnOffset: -1 },
  { key: "ArrowRight", rowOffset: 0, columnOffset: 1 },
];

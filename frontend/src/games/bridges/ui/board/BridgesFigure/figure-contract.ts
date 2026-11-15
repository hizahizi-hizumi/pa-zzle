import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";

/**
 * - `edges`: ロープを張る辺。交わる橋に阻まれて今は架けられない辺は含めない。
 * - `aimEdge`: なぞる指が向いている辺。決まらなければ `null`。ほかのロープを淡くし、この辺のロープを目立たせる。
 * - `previewEdge`: 今離せば橋を回す辺。`aimEdge` の相手の島に指が届いたときだけ持つ。決まらなければ `null`。
 */
export type BridgesFigureGuide = {
  island: number;
  edges: readonly number[];
  aimEdge: number | null;
  previewEdge: number | null;
};

/** 交わる橋に阻まれた操作。`edge` は押した辺、`island` は板を伸ばし始める端の島。 */
export type BridgesBlockedAttempt = { edge: number; island: number };

/**
 * 板の寸法。図の寸法はマス幅を 1 とした値。
 * - `single`・`double`: 1本・2本の橋の板1枚の幅。
 * - `spacing`: 2本の橋の2枚の板の中心どうしの間隔。
 */
export type PlankLayout = {
  single: number;
  double: number;
  spacing: number;
  seams: boolean;
};

/**
 * 全島がつながった盤面で、板に重ねる明るい木の色の面の渡り方。
 * - `depth`: その板へ光が渡り始める段数。
 * - `origin`: 光が渡り始める島の中心。段の違う島を結ぶ板は、段の浅い島から相手の島へ伸ばす。
 *   同じ段の島を結ぶ板（最後に架けた橋など）は `null` にし、伸ばさずに浮かび上がらせる。
 */
export type LitDeckWave = {
  depth: number;
  origin: BoardPoint | null;
};

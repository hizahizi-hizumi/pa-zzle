/**
 * 人間向けの手筋。並び順が浅い順。
 * - `adjacency`（A 隣接・挟み）: 3マスの並びに同じタイルが2つあれば、残る1マスは反対のタイル。
 * - `count-completion`（B 個数の完成）: 行・列に片方のタイルが半分そろえば、残りの空きマスは反対のタイル。
 * - `single-remaining`（C 残り1個）: 片方のタイルが残り1個の行・列で、その1個を置ける位置を読んで確定する。
 * - `duplicate-avoidance`（D 重複の回避）: C と同じ行・列で、完成済みの行（列）と同じ並びになる置き方も除いて確定する。
 * - `general-line`（E 一般の行候補）: 両方のタイルが残り2個以上の行・列で、ルールを満たす並び（完成済みの行・列との重複を除く）を読み比べて確定する。
 *
 * どれも1本の行・列の中だけで読む推論で、2本以上の行・列を組み合わせる推論は扱わない。
 * 手筋の推論は `generation/human-solver.ts` が持ち、ここは難易度の特徴量や生成条件でも使う名前だけを持つ。
 */
export const takuzuTechniques = [
  "adjacency",
  "count-completion",
  "single-remaining",
  "duplicate-avoidance",
  "general-line",
] as const;

export type TakuzuTechnique = (typeof takuzuTechniques)[number];

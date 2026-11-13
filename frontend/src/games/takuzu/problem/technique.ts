/**
 * 人間向けの手筋。浅い順に、SPEC-012 の推論の段階 A〜E に当たる。
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

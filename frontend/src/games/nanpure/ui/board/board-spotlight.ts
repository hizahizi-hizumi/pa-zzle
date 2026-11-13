/** `index` は0始まりで、ブロックは左上から行優先に数える。 */
export type NanpureBoardUnit = {
  kind: "row" | "column" | "block";
  index: number;
};

/**
 * チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せる所。
 * `units` は、まとまりのマスをまとめて1つの形で抜く。
 */
export type NanpureBoardSpotlight = {
  cellIndices: readonly number[];
  units: readonly NanpureBoardUnit[];
};

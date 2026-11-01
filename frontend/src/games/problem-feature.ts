/**
 * 問題を始めたときの盤面を見れば分かる特徴の、1つの軸の値。図鑑の絞り込みで問題を分けるのに使う。
 * 数と、盤面の行と列の数で表す。正方形の盤面も行と列で表す。
 */
export type ProblemFeatureValue =
  | { kind: "count"; count: number }
  | { kind: "board-size"; rows: number; columns: number };

/**
 * 問題の特徴を分ける1つの軸。ゲームが自分の特徴の型 `Features` から値を取り出す。
 * 数の軸は、1つのレベルの問題集にある値の種類が多いとき、`countRangeWidth` の幅の範囲にまとめる。まとめ方はゲームが決める。
 */
export type ProblemFeatureAxis<Features, Id extends string = string> = {
  id: Id;
  getValue(features: Features): ProblemFeatureValue;
  countRangeWidth?: number;
};

export function createCountFeatureValue(count: number): ProblemFeatureValue {
  return { kind: "count", count };
}

export function createBoardSizeFeatureValue(
  rows: number,
  columns: number,
): ProblemFeatureValue {
  return { kind: "board-size", rows, columns };
}

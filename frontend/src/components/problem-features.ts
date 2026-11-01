/**
 * 問題を始めたときの盤面を見れば分かる、その問題の特徴の1つを示す名前と値。
 * 解かないと分からないこと（最短手数・要る手筋など）は特徴にしない。
 */
export type ProblemFeature = { label: string; value: string };

/** 特徴の数を示すときの単位。数には必ず単位を付ける。 */
export type ProblemFeatureCountUnit =
  | "個"
  | "本"
  | "台"
  | "マス"
  | "か所"
  | "種類";

export function createProblemCountFeature(
  label: string,
  count: number,
  unit: ProblemFeatureCountUnit,
): ProblemFeature {
  return { label, value: `${count}${unit}` };
}

/** 正方形とは限らない盤面の大きさ。縦と横を取り違えないよう、行と列の数を名前付きで示す。 */
export function createBoardSizeFeature(
  label: string,
  { rows, columns }: { rows: number; columns: number },
): ProblemFeature {
  return { label, value: `${rows}行×${columns}列` };
}

/** 正方形の盤面の大きさ。 */
export function createSquareBoardSizeFeature(
  label: string,
  size: number,
): ProblemFeature {
  return { label, value: `${size}×${size}` };
}

import type {
  ProblemFeatureAxis,
  ProblemFeatureValue,
} from "@/games/problem-feature";

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

/**
 * 問題の特徴の1つの軸の名前と、値の書き方。
 * 数は単位を付けて書き、盤面は行と列の数で書く。正方形の盤面しか無い軸は辺の数で書く。
 */
export type ProblemFeatureAxisDisplay = {
  label: string;
  valueFormat:
    | { kind: "count"; unit: ProblemFeatureCountUnit }
    | { kind: "board-size" }
    | { kind: "square-board-size" };
};

export function formatProblemFeatureCount(
  count: number,
  unit: ProblemFeatureCountUnit,
): string {
  return `${count}${unit}`;
}

/** 正方形とは限らない盤面の大きさは、縦と横を取り違えないよう、行と列の数を名前付きで示す。 */
function formatBoardSize(rows: number, columns: number): string {
  return `${rows}行×${columns}列`;
}

export function formatProblemFeatureValue(
  value: ProblemFeatureValue,
  { valueFormat }: ProblemFeatureAxisDisplay,
): string {
  if (value.kind === "count") {
    return valueFormat.kind === "count"
      ? formatProblemFeatureCount(value.count, valueFormat.unit)
      : String(value.count);
  }
  return valueFormat.kind === "square-board-size" &&
    value.rows === value.columns
    ? `${value.rows}×${value.columns}`
    : formatBoardSize(value.rows, value.columns);
}

/** 問題の特徴を、軸の順に名前と値の組にする。 */
export function formatProblemFeatures<Features, Id extends string>(
  features: Features,
  axes: readonly ProblemFeatureAxis<Features, Id>[],
  displays: Readonly<Record<Id, ProblemFeatureAxisDisplay>>,
): ProblemFeature[] {
  return axes.map((axis) => {
    const display = displays[axis.id];
    return {
      label: display.label,
      value: formatProblemFeatureValue(axis.getValue(features), display),
    };
  });
}

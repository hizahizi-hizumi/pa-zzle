import type {
  ProblemFeatureAxis,
  ProblemFeatureValue,
} from "@/games/problem-feature";

export type ProblemFeature = { label: string; value: string };

export type ProblemFeatureCountUnit =
  | "個"
  | "本"
  | "台"
  | "マス"
  | "か所"
  | "種類"
  | "手"
  | "枚";

export type ProblemFeatureAxisDisplay = {
  label: string;
  valueFormat:
    | { kind: "count"; unit: ProblemFeatureCountUnit; rangeWidth?: number }
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

/** プレイ結果の画面へ渡す表示済みの指標。 */
export type GameResultMetric = {
  label: string;
  recordMetricId?: string;
  value: string;
  comparison?: {
    basis: "referenceTime" | "minimumMoves";
    difference: number;
    display: string;
  };
};

export type GameResultDetailMetric = {
  label: string;
  value: string;
};

export type GameResultScoreCriterion = {
  label: string;
  description: string;
};

export type GameResultScoreCriteria = readonly GameResultScoreCriterion[];

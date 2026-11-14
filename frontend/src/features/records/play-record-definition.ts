import type { PlayRecord } from "@/features/records/play-record";

export type PersonalBestMetricDefinition<MetricId extends string = string> = {
  id: MetricId;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
};

/** 全ゲームの記録定義が持つ、評価点（100点満点）の指標の ID。 */
export const PLAY_SCORE_METRIC_ID = "play-score";

/**
 * クリアしたプレイの成績のうち、どのゲームでも同じ意味で読める事実。
 * 手数とミスは、それを数えて評価に使うゲームだけが持つ。
 */
export type PlayRecordClearPerformance = {
  elapsedMs: number;
  moves?: { completionMoveCount: number; optimalMoveCount: number };
  mistakeCount?: number;
};

export type PlayRecordDefinition<MetricId extends string = string> = {
  gameId: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonKey: (record: PlayRecord) => string | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition<MetricId>[];
  getClearPerformance: (
    record: PlayRecord,
  ) => PlayRecordClearPerformance | null;
};

export type PlayRecordMetricId<Definition extends PlayRecordDefinition> =
  Definition["personalBestMetrics"][number]["id"];

export function getPlayRecordMetricValue(
  record: PlayRecord,
  definition: PlayRecordDefinition,
  metricId: string,
): number | null {
  const metric = definition.personalBestMetrics.find(
    (candidate) => candidate.id === metricId,
  );
  return metric?.getValue(record) ?? null;
}

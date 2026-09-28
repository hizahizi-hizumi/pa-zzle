import type { PlayRecord } from "@/records/play-record";

export type PersonalBestMetricDefinition<MetricId extends string = string> = {
  id: MetricId;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
};

export type PlayRecordDefinition<MetricId extends string = string> = {
  gameId: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonKey: (record: PlayRecord) => string | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition<MetricId>[];
};

/** 記録定義が自己ベストとして扱う指標 ID の共用体。 */
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

import type { PlayRecord } from "@/records/play-record";

export type PersonalBestMetricDefinition = {
  id: string;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
};

export type PlayRecordDefinition = {
  gameId: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonKey: (record: PlayRecord) => string | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition[];
};

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

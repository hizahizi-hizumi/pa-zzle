import type { PlayRecord } from "../play-record";
import type { PlayRecordDefinition } from "../play-record-definition";

export type PlayRecordDisplayMetric = {
  label: string;
  value: string;
};

export type PlayRecordSummary = {
  primaryMetric: PlayRecordDisplayMetric;
  detailMetrics: readonly PlayRecordDisplayMetric[];
};

export type PersonalBestMetricDisplay = {
  id: string;
  label: string;
  formatValue: (value: number) => string;
};

export type PlayRecordDisplayDefinition = {
  definition: PlayRecordDefinition;
  gameLabel: string;
  getComparisonLabel: (comparisonKey: string) => string | null;
  getSummary: (record: PlayRecord) => PlayRecordSummary | null;
  personalBestMetrics: readonly PersonalBestMetricDisplay[];
};

export type PlayRecordDisplayCatalog = readonly [
  PlayRecordDisplayDefinition,
  ...PlayRecordDisplayDefinition[],
];

export function getPersonalBestMetricDisplay(
  display: PlayRecordDisplayDefinition,
  metricId: string,
): PersonalBestMetricDisplay | undefined {
  return display.personalBestMetrics.find((metric) => metric.id === metricId);
}

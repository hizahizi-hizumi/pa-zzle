import type { PlayRecordDefinition } from "../play-record-definition";

export type PlayRecordMetricDisplay = {
  id: string;
  label: string;
  historyLabel: string;
  formatValue: (value: number) => string;
  referenceValue?: number;
};

export type PlayRecordDisplayDefinition = {
  definition: PlayRecordDefinition;
  gameLabel: string;
  getComparisonLabel: (comparisonKey: string) => string | null;
  metrics: readonly PlayRecordMetricDisplay[];
};

export type PlayRecordDisplayCatalog = readonly [
  PlayRecordDisplayDefinition,
  ...PlayRecordDisplayDefinition[],
];

export function getPlayRecordMetricDisplay(
  display: PlayRecordDisplayDefinition,
  metricId: string,
): PlayRecordMetricDisplay | undefined {
  return display.metrics.find((metric) => metric.id === metricId);
}

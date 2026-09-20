import type { PlayRecordDefinition } from "../play-record-definition";

type PlayRecordMetricAxisBounds = {
  minimum?: number;
  maximum?: number;
};

export type PlayRecordMetricAxisDisplay = PlayRecordMetricAxisBounds &
  ({ kind: "integer" } | { kind: "duration-ms" });

export type PlayRecordMetricDisplay = {
  id: string;
  label: string;
  historyLabel: string;
  formatValue: (value: number) => string;
  referenceValue?: number;
  axis?: PlayRecordMetricAxisDisplay;
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

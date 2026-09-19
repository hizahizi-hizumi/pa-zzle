import type { PlayRecord } from "./play-record";

export type PlayRecordSummaryMetric = {
  label: string;
  value: string;
};

export type PlayRecordSummary = {
  primaryMetric: PlayRecordSummaryMetric;
  detailMetrics: readonly PlayRecordSummaryMetric[];
};

export type PlayRecordComparisonGroup = {
  key: string;
  label: string;
};

export type PersonalBestMetricDefinition = {
  id: string;
  label: string;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
  formatValue: (value: number) => string;
};

export type PlayRecordDefinition = {
  gameId: string;
  gameLabel: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonGroup: (record: PlayRecord) => PlayRecordComparisonGroup | null;
  getSummary: (record: PlayRecord) => PlayRecordSummary | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition[];
};

import type { PlayRecord } from "./play-record";

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

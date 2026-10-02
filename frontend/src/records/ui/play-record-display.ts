import type { PlayRecord } from "@/records/play-record";
import type {
  PlayRecordDefinition,
  PlayRecordMetricId,
} from "@/records/play-record-definition";

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

type PlayRecordMetricPresentation = Omit<PlayRecordMetricDisplay, "id">;

export type PlayRecordDisplayDefinition = {
  definition: PlayRecordDefinition;
  getComparisonLabel: (comparisonKey: string) => string | null;
  getHistoryCopyText?: (record: PlayRecord) => string | null;
  metrics: readonly PlayRecordMetricDisplay[];
};

type PlayRecordDisplaySource<Definition extends PlayRecordDefinition> = Omit<
  PlayRecordDisplayDefinition,
  "definition" | "metrics"
> & {
  definition: Definition;
  metrics: Record<PlayRecordMetricId<Definition>, PlayRecordMetricPresentation>;
};

/** 記録画面で選べる1つのゲーム。 */
export type PlayRecordGame = {
  name: string;
  playRecordDisplay: PlayRecordDisplayDefinition;
};

export type PlayRecordGameCatalog = readonly [
  PlayRecordGame,
  ...PlayRecordGame[],
];

/**
 * 記録定義の全指標に表示を対応させた記録表示を作る。
 * 指標は記録定義の並び順で表示する。
 */
export function createPlayRecordDisplay<
  Definition extends PlayRecordDefinition,
>({
  metrics,
  ...display
}: PlayRecordDisplaySource<Definition>): PlayRecordDisplayDefinition {
  return {
    ...display,
    metrics: display.definition.personalBestMetrics.map(
      ({ id }: { id: PlayRecordMetricId<Definition> }) => ({
        id,
        ...metrics[id],
      }),
    ),
  };
}

export function getPlayRecordMetricDisplay(
  display: PlayRecordDisplayDefinition,
  metricId: string,
): PlayRecordMetricDisplay | undefined {
  return display.metrics.find((metric) => metric.id === metricId);
}

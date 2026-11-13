import { formatDurationInWords } from "@/lib/format-elapsed-time";
import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";
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
  formatValue: (value: number) => string;
  /** 自己ベストを更新した幅。良くなった向きの差を0以上の値で受け取る。 */
  formatImprovement: (amount: number) => string;
  referenceValue?: number;
  axis?: PlayRecordMetricAxisDisplay;
};

type PlayRecordMetricPresentation = Omit<PlayRecordMetricDisplay, "id">;

export type PlayRecordDisplayDefinition = {
  definition: PlayRecordDefinition;
  getComparisonLabel: (comparisonKey: string) => string | null;
  metrics: readonly PlayRecordMetricDisplay[];
};

type PlayRecordDisplaySource<Definition extends PlayRecordDefinition> = Omit<
  PlayRecordDisplayDefinition,
  "definition" | "metrics"
> & {
  definition: Definition;
  metrics: Record<PlayRecordMetricId<Definition>, PlayRecordMetricPresentation>;
};

/**
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

type PlayRecordCountUnit = "回" | "手" | "本" | "マス";

export const playScoreMetricPresentation: PlayRecordMetricPresentation = {
  label: "スコア",
  formatValue(value: number) {
    return `${value}点`;
  },
  formatImprovement(amount: number) {
    return `+${amount}点`;
  },
  referenceValue: 100,
  axis: { kind: "integer", minimum: 0, maximum: 100 },
};

export const timeDeltaMetricPresentation: PlayRecordMetricPresentation = {
  label: "基準時間との差",
  formatValue: formatElapsedTimeDelta,
  formatImprovement(amount: number) {
    const wholeSecondsMs = Math.floor(amount / 1_000) * 1_000;
    return `${formatDurationInWords(wholeSecondsMs)}短縮`;
  },
  referenceValue: 0,
  axis: { kind: "duration-ms" },
};

/** 少ないほど良い回数。 */
export function createCountMetricPresentation(
  label: string,
  unit: PlayRecordCountUnit,
): PlayRecordMetricPresentation {
  return {
    label,
    formatValue(value: number) {
      return `${value}${unit}`;
    },
    formatImprovement(amount: number) {
      return `${amount}${unit}減`;
    },
    referenceValue: 0,
    axis: { kind: "integer", minimum: 0 },
  };
}

export const moveDeltaMetricPresentation: PlayRecordMetricPresentation = {
  label: "最短手数との差",
  formatValue: formatCountDelta,
  formatImprovement(amount: number) {
    return `${amount}手減`;
  },
  referenceValue: 0,
  axis: { kind: "integer", minimum: 0 },
};

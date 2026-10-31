import {
  formatDurationInWords,
  formatElapsedTime,
} from "@/lib/format-elapsed-time";
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
  historyLabel: string;
  formatValue: (value: number) => string;
  /** 自己ベストを更新した幅。良くなった向きの差を0以上の値で受け取る。 */
  formatImprovement: (amount: number) => string;
  referenceValue?: number;
  axis?: PlayRecordMetricAxisDisplay;
};

type PlayRecordMetricPresentation = Omit<PlayRecordMetricDisplay, "id">;

type PlayAttemptProgressDisplay = {
  label: string;
  formatValue: (value: number) => string;
};

export type PlayRecordDisplayDefinition = {
  definition: PlayRecordDefinition;
  getComparisonLabel: (comparisonKey: string) => string | null;
  metrics: readonly PlayRecordMetricDisplay[];
  /** 離脱したプレイで見せる進み具合。進み具合の名前ごとの表示を、見せる順に並べる。 */
  progress: Readonly<Record<string, PlayAttemptProgressDisplay>>;
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

/** 数を示すときの単位。数には必ず単位を付ける。 */
type PlayRecordCountUnit = "回" | "手";

/** 100点満点の評価点。 */
export const playScoreMetricPresentation: PlayRecordMetricPresentation = {
  label: "スコア",
  historyLabel: "スコア",
  formatValue(value: number) {
    return `${value}点`;
  },
  formatImprovement(amount: number) {
    return `+${amount}点`;
  },
  referenceValue: 100,
  axis: { kind: "integer", minimum: 0, maximum: 100 },
};

/** 問題ごとの基準時間とクリア時間との差。 */
export const timeDeltaMetricPresentation: PlayRecordMetricPresentation = {
  label: "基準時間との差",
  historyLabel: "時間差",
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
    historyLabel: label,
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

/** 最短手数とクリア手数との差。 */
export const moveDeltaMetricPresentation: PlayRecordMetricPresentation = {
  label: "最短手数との差",
  historyLabel: "手数差",
  formatValue: formatCountDelta,
  formatImprovement(amount: number) {
    return `${amount}手減`;
  },
  referenceValue: 0,
  axis: { kind: "integer", minimum: 0 },
};

/** 離脱したプレイの経過時間。 */
export const elapsedTimeProgressDisplay: PlayAttemptProgressDisplay = {
  label: "時間",
  formatValue: formatElapsedTime,
};

/** 離脱したプレイまでに数えた回数。 */
export function createCountProgressDisplay(
  label: string,
  unit: PlayRecordCountUnit,
): PlayAttemptProgressDisplay {
  return {
    label,
    formatValue(value: number) {
      return `${value}${unit}`;
    },
  };
}

import type { PlayRecord } from "@/records/play-record";

export type PersonalBestMetricDefinition<MetricId extends string = string> = {
  id: MetricId;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
};

/** 全ゲームの記録定義が持つ、評価点（100点満点）の指標の ID。 */
export const PLAY_SCORE_METRIC_ID = "play-score";

/**
 * クリアしたプレイの成績のうち、どのゲームでも同じ意味で読める事実。同じ問題のクリアどうしで最も良い値を比べるのに使う。
 * 手数とミスは、それを数えて評価に使うゲームだけが持つ。
 */
export type PlayRecordClearPerformance = {
  /** クリアまでの経過時間。 */
  elapsedMs: number;
  /** 完成までの手数と、その問題の最短手数。 */
  moves?: { completionMoveCount: number; optimalMoveCount: number };
  mistakeCount?: number;
};

export type PlayRecordDefinition<MetricId extends string = string> = {
  gameId: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonKey: (record: PlayRecord) => string | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition<MetricId>[];
  /** 記録からクリアの成績を読む。このゲームの記録として読めなければ `null` を返す。 */
  getClearPerformance: (
    record: PlayRecord,
  ) => PlayRecordClearPerformance | null;
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

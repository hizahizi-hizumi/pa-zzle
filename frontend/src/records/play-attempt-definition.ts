import type { PlayAttempt } from "@/records/play-attempt";

/** 離脱した時点の進み具合として見せる1つの値。離脱していない試行や読めない試行では `null`。 */
type PlayAttemptProgressDefinition<ProgressId extends string = string> = {
  id: ProgressId;
  getValue: (attempt: PlayAttempt) => number | null;
};

/**
 * ゲームごとの、保存済みのプレイ試行の読み戻し方。
 * - `isAttempt`: 今のアプリが読める開始条件を持ち、離脱していればその進み具合も読める試行か。
 * - `getComparisonKey`: 同じ開始条件の完了記録に完了記録定義の `getComparisonKey` が返す値と同じ値を返す。
 * - `progress`: 離脱した時点の進み具合として見せる値。
 */
export type PlayAttemptDefinition<ProgressId extends string = string> = {
  gameId: string;
  isAttempt: (attempt: PlayAttempt) => boolean;
  getComparisonKey: (attempt: PlayAttempt) => string | null;
  progress: readonly PlayAttemptProgressDefinition<ProgressId>[];
};

/** 試行定義が進み具合として扱う値 ID の共用体。 */
export type PlayAttemptProgressId<Definition extends PlayAttemptDefinition> =
  Definition["progress"][number]["id"];

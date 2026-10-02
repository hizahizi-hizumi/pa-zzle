import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";

/** 履歴一覧の1行。完了したプレイと、離脱したプレイを同じ時系列に並べる。 */
export type PlayHistoryEntry =
  | { kind: "cleared"; key: string; occurredAt: number; record: PlayRecord }
  | {
      kind: "abandoned";
      key: string;
      occurredAt: number;
      attempt: AbandonedPlayAttempt;
    };

/** 完了した記録は完了日時、離脱した試行は離れた日時で、新しい順に並べる。 */
export function getPlayHistoryEntries(
  records: readonly PlayRecord[],
  abandonedAttempts: readonly AbandonedPlayAttempt[],
): PlayHistoryEntry[] {
  const entries: PlayHistoryEntry[] = [
    ...records.map(
      (record): PlayHistoryEntry => ({
        kind: "cleared",
        key: `record:${record.id}`,
        occurredAt: record.completedAt,
        record,
      }),
    ),
    ...abandonedAttempts.map(
      (attempt): PlayHistoryEntry => ({
        kind: "abandoned",
        key: `attempt:${attempt.id}`,
        occurredAt: attempt.abandonment.abandonedAt,
        attempt,
      }),
    ),
  ];
  return entries.sort((left, right) => right.occurredAt - left.occurredAt);
}

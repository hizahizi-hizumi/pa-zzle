import type { AbandonedPlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import { getPlayHistoryEntries } from "@/records/ui/PlayRecordsScreen/play-history-entries";

function createRecord(startedAt: number, completedAt: number): PlayRecord {
  return {
    id: `test-game:${startedAt}:${completedAt}`,
    gameId: "test-game",
    startedAt,
    completedAt,
    payloadVersion: 1,
    payload: {},
  };
}

function createAbandonedAttempt(
  startedAt: number,
  abandonedAt: number,
): AbandonedPlayAttempt {
  return {
    id: `test-game:${startedAt}`,
    gameId: "test-game",
    startedAt,
    payloadVersion: 1,
    start: {},
    abandonment: { abandonedAt, progress: {} },
  };
}

test("完了日時と離れた日時で新しい順に混ぜて並べること", () => {
  const entries = getPlayHistoryEntries(
    [createRecord(1_000, 5_000), createRecord(10_000, 30_000)],
    [createAbandonedAttempt(6_000, 20_000), createAbandonedAttempt(0, 2_000)],
  );

  expect(entries.map(({ kind, occurredAt }) => [kind, occurredAt])).toEqual([
    ["cleared", 30_000],
    ["abandoned", 20_000],
    ["cleared", 5_000],
    ["abandoned", 2_000],
  ]);
});

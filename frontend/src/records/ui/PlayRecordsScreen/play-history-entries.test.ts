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

describe("getPlayHistoryEntries", () => {
  const records = [createRecord(1_000, 5_000), createRecord(10_000, 30_000)];
  const abandonedAttempts = [
    createAbandonedAttempt(6_000, 20_000),
    createAbandonedAttempt(0, 2_000),
  ];

  test("完了日時と離れた日時で新しい順に混ぜて並べること", () => {
    const entries = getPlayHistoryEntries(records, abandonedAttempts);
    const order = entries.map(({ kind, occurredAt }) => [kind, occurredAt]);

    expect(order).toEqual([
      ["cleared", 30_000],
      ["abandoned", 20_000],
      ["cleared", 5_000],
      ["abandoned", 2_000],
    ]);
  });
});

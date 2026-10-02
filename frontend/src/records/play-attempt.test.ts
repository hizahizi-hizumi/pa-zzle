import {
  getAbandonedPlayAttempts,
  getPlayAttemptStatus,
  isPlayAttempt,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";

const attempt: PlayAttempt = {
  id: "test-game:1000",
  gameId: "test-game",
  startedAt: 1_000,
  payloadVersion: 1,
  start: { difficulty: "3" },
  abandonment: null,
};

const abandoned: PlayAttempt = {
  ...attempt,
  abandonment: { abandonedAt: 5_000, progress: { elapsedMs: 4_000 } },
};

const { start: _start, ...withoutStart } = attempt;

function createRecord(gameId: string, startedAt: number): PlayRecord {
  return {
    id: `${gameId}:${startedAt}:9000`,
    gameId,
    startedAt,
    completedAt: 9_000,
    payloadVersion: 1,
    payload: {},
  };
}

describe("getPlayAttemptStatus", () => {
  const clearedRecords = [createRecord("test-game", 1_000)];
  const otherRecords = [
    createRecord("other-game", 1_000),
    createRecord("test-game", 2_000),
  ];
  const cases = [
    [
      "同じゲームで同じ時刻に始めた完了記録があればクリアとすること",
      attempt,
      clearedRecords,
      "cleared",
    ],
    [
      "離脱を記録していても完了記録を優先すること",
      abandoned,
      clearedRecords,
      "cleared",
    ],
    [
      "完了記録が無く離脱を記録していれば離脱とすること",
      abandoned,
      otherRecords,
      "abandoned",
    ],
    ["完了記録も離脱も無ければ未完了とすること", attempt, [], "unfinished"],
  ] as const;

  test.each(cases)("%s", (_, target, records, expected) => {
    const status = getPlayAttemptStatus(target, records);

    expect(status).toBe(expected);
  });
});

describe("getAbandonedPlayAttempts", () => {
  const abandonedLater: PlayAttempt = {
    ...abandoned,
    id: "test-game:2000",
    startedAt: 2_000,
    abandonment: { abandonedAt: 6_000, progress: {} },
  };
  const records = [createRecord("test-game", 2_000)];

  test("離脱の試行だけを選び、未完了とクリアの試行を除くこと", () => {
    const abandonedAttempts = getAbandonedPlayAttempts(
      [attempt, abandoned, abandonedLater],
      records,
    );

    expect(abandonedAttempts).toEqual([abandoned]);
  });
});

describe("isPlayAttempt", () => {
  const readableCases = [
    ["開始だけを記録した", attempt],
    ["離脱を記録した", abandoned],
  ] as const;
  const unreadableCases = [
    ["開始条件が無い", withoutStart],
    [
      "開始より前に離れている",
      { ...attempt, abandonment: { abandonedAt: 500, progress: {} } },
    ],
    ["進み具合が無い", { ...attempt, abandonment: { abandonedAt: 5_000 } }],
  ] as const;

  test.each(readableCases)("%s試行を解釈できること", (_, value) => {
    const readable = isPlayAttempt(value);

    expect(readable).toBe(true);
  });

  test.each(unreadableCases)("%s試行を解釈しないこと", (_, value) => {
    const readable = isPlayAttempt(value);

    expect(readable).toBe(false);
  });
});

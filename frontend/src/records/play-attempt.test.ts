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
  test("同じゲームで同じ時刻に始めた完了記録があればクリアとすること", () => {
    const records = [createRecord("test-game", 1_000)];

    expect(getPlayAttemptStatus(attempt, records)).toBe("cleared");
  });

  test("離脱を記録していても完了記録を優先すること", () => {
    const records = [createRecord("test-game", 1_000)];

    expect(getPlayAttemptStatus(abandoned, records)).toBe("cleared");
  });

  test("完了記録が無く離脱を記録していれば離脱とすること", () => {
    const records = [
      createRecord("other-game", 1_000),
      createRecord("test-game", 2_000),
    ];

    expect(getPlayAttemptStatus(abandoned, records)).toBe("abandoned");
  });

  test("完了記録も離脱も無ければ未完了とすること", () => {
    expect(getPlayAttemptStatus(attempt, [])).toBe("unfinished");
  });
});

describe("getAbandonedPlayAttempts", () => {
  test("離脱の試行だけを選び、未完了とクリアの試行を除くこと", () => {
    const abandonedLater: PlayAttempt = {
      ...abandoned,
      id: "test-game:2000",
      startedAt: 2_000,
      abandonment: { abandonedAt: 6_000, progress: {} },
    };
    const records = [createRecord("test-game", 2_000)];

    expect(
      getAbandonedPlayAttempts([attempt, abandoned, abandonedLater], records),
    ).toEqual([abandoned]);
  });
});

describe("isPlayAttempt", () => {
  test("開始記録と離脱を記録した試行を解釈できること", () => {
    expect(isPlayAttempt(attempt)).toBe(true);
    expect(isPlayAttempt(abandoned)).toBe(true);
  });

  test.each([
    ["開始条件が無い", withoutStart],
    [
      "開始より前に離れている",
      { ...attempt, abandonment: { abandonedAt: 500, progress: {} } },
    ],
    ["進み具合が無い", { ...attempt, abandonment: { abandonedAt: 5_000 } }],
  ])("%s試行を解釈しないこと", (_, value) => {
    expect(isPlayAttempt(value)).toBe(false);
  });
});

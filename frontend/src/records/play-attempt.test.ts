import {
  isPlayAttempt,
  isPlayAttemptCleared,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";

const attempt: PlayAttempt = {
  gameId: "test-game",
  startedAt: 1_000,
  start: { difficulty: "3", problemIdentity: { seed: "a" } },
  abandonment: null,
};

const abandoned: PlayAttempt = {
  ...attempt,
  abandonment: {
    abandonedAt: 5_000,
    progress: { elapsedMs: 4_000, moveCount: 0 },
  },
};

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

describe("isPlayAttemptCleared", () => {
  const cases = [
    [
      "同じゲームで同じ時刻に始めた完了記録があればクリアとすること",
      attempt,
      [createRecord("test-game", 1_000)],
      true,
    ],
    [
      "離脱を記録していても完了記録を優先すること",
      abandoned,
      [createRecord("test-game", 1_000)],
      true,
    ],
    [
      "別のゲームや別の時刻に始めた完了記録ではクリアとしないこと",
      abandoned,
      [createRecord("other-game", 1_000), createRecord("test-game", 2_000)],
      false,
    ],
  ] as const;

  test.each(cases)("%s", (_, target, records, expected) => {
    const cleared = isPlayAttemptCleared(target, records);

    expect(cleared).toBe(expected);
  });
});

describe("isPlayAttempt", () => {
  const readableCases = [
    ["開始だけを記録した", attempt],
    ["離脱を記録した", abandoned],
  ] as const;
  const unreadableCases = [
    ["開始条件の難易度が無い", { ...attempt, start: { problemIdentity: {} } }],
    ["問題識別情報が無い", { ...attempt, start: { difficulty: "3" } }],
    [
      "開始より前に離れている",
      { ...abandoned, abandonment: { abandonedAt: 500, progress: {} } },
    ],
    [
      "負の進み具合を持つ",
      {
        ...abandoned,
        abandonment: { abandonedAt: 5_000, progress: { elapsedMs: -1 } },
      },
    ],
    [
      "数値でない進み具合を持つ",
      {
        ...abandoned,
        abandonment: { abandonedAt: 5_000, progress: { elapsedMs: "1" } },
      },
    ],
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

import {
  createWaterSortPlayAttempt,
  createWaterSortPlayAttemptProgress,
  isWaterSortPlayAttempt,
  waterSortPlayAttemptDefinition,
} from "@/games/water-sort/play-attempt";
import {
  createWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import type { WaterSortProblem } from "@/games/water-sort/problem/problem";
import { createWaterSortSession } from "@/games/water-sort/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

const problemIdentity = {
  generatorVersion: "1",
  seed: "water-sort-seed",
  conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
  generationAttempt: 1,
} as const;

const attemptInput: Parameters<typeof createWaterSortPlayAttempt>[0] = {
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
};

const attempt = createWaterSortPlayAttempt(attemptInput);

const problem: WaterSortProblem = {
  initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
};
const session = {
  ...createWaterSortSession(problem, 1_000),
  moveCount: 7,
  undoCount: 2,
  restartCount: 1,
};

const record = createWaterSortPlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  result: {
    elapsedMs: 65_000,
    moveCount: 14,
    completionMoveCount: 12,
    undoCount: 2,
    restartCount: 0,
    optimalMoveCount: 10,
  },
});

describe("createWaterSortPlayAttempt", () => {
  test("開始条件だけを持つ開始記録を作ること", () => {
    const created = createWaterSortPlayAttempt(attemptInput);

    expect(created).toEqual({
      id: "water-sort:1000",
      gameId: "water-sort",
      startedAt: 1_000,
      payloadVersion: 1,
      start: {
        difficulty: "3",
        problemIdentity,
      },
      abandonment: null,
    });
    expect(created.start.problemIdentity).not.toBe(problemIdentity);
  });

  test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
    const created = createWaterSortPlayAttempt(attemptInput);
    const status = getPlayAttemptStatus(created, [record]);

    expect(status).toBe("cleared");
  });
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createWaterSortPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveCount: 7,
    undoCount: 2,
    restartCount: 1,
  });
});

function getProgressValues(value: PlayAttempt) {
  return Object.fromEntries(
    waterSortPlayAttemptDefinition.progress.map(({ id, getValue }) => [
      id,
      getValue(value),
    ]),
  );
}

describe("waterSortPlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createWaterSortPlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));
  const storedStart: PlayAttempt = JSON.parse(JSON.stringify(attempt));
  const recordComparisonKey =
    waterSortPlayRecordDefinition.getComparisonKey(record);
  const readableCases = [
    ["開始だけを記録した", storedStart],
    ["離脱を記録した", stored],
  ] as const;
  const unreadableCases = [
    ["未知の版の", { ...stored, payloadVersion: 2 }],
    ["別のゲームの", { ...stored, gameId: "other-game" }],
    [
      "読めない開始条件の",
      { ...stored, start: { ...abandoned.start, difficulty: "unknown" } },
    ],
    [
      "読めない進み具合の",
      {
        ...stored,
        abandonment: { abandonedAt: 41_000, progress: { elapsedMs: -1 } },
      },
    ],
  ] as const;

  test.each(readableCases)("保存した%s試行を読み戻せること", (_, value) => {
    const readable = isWaterSortPlayAttempt(value);

    expect(readable).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      waterSortPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(recordComparisonKey);
  });

  test("離れた時点の進み具合を返すこと", () => {
    const progress = getProgressValues(stored);

    expect(progress).toEqual({
      "elapsed-ms": 40_000,
      "move-count": 7,
    });
  });

  test("離脱していない試行では進み具合を返さないこと", () => {
    const progress = getProgressValues(storedStart);

    expect(Object.values(progress).filter((value) => value !== null)).toEqual(
      [],
    );
  });

  test.each(unreadableCases)(
    "%s試行を読まず、比較キーも返さないこと",
    (_, value) => {
      const readable = isWaterSortPlayAttempt(value);
      const comparisonKey =
        waterSortPlayAttemptDefinition.getComparisonKey(value);

      expect(readable).toBe(false);
      expect(comparisonKey).toBeNull();
    },
  );
});

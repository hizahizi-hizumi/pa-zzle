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

const attempt = createWaterSortPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

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

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
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
  expect(attempt.start.problemIdentity).not.toBe(problemIdentity);
});

test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
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

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isWaterSortPlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isWaterSortPlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      waterSortPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      waterSortPlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        waterSortPlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "move-count": 7,
    });
    expect(
      Object.values(progressOf(attempt)).every((value) => value === null),
    ).toBe(true);
  });

  test.each([
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
  ])("%s試行を読まないこと", (_, value) => {
    expect(isWaterSortPlayAttempt(value)).toBe(false);
    expect(waterSortPlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

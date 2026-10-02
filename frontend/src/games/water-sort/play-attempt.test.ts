import {
  createWaterSortPlayAttempt,
  createWaterSortPlayAttemptProgress,
} from "@/games/water-sort/play-attempt";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import type { WaterSortProblem } from "@/games/water-sort/problem/problem";
import { createWaterSortSession } from "@/games/water-sort/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

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

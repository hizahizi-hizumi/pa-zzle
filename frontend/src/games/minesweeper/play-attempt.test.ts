import {
  createMinesweeperPlayAttempt,
  createMinesweeperPlayAttemptProgress,
} from "@/games/minesweeper/play-attempt";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { createMinesweeperSession } from "@/games/minesweeper/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

const problemIdentity = {
  generatorVersion: "1",
  seed: "ms-pool-3-10x10-16-0",
  conditions: {
    rows: 10,
    columns: 10,
    mineCount: 16,
    startCellPlacement: "random",
  },
  generationAttempt: 1,
} as const;

const attempt = createMinesweeperPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const problem: MinesweeperProblem = {
  board: { rows: 2, columns: 3, mineCellIndices: [0] },
  initialRevealedCellIndices: [1],
};
const session = {
  ...createMinesweeperSession(problem, 1_000),
  mistakeCount: 2,
};

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "minesweeper:1000",
    gameId: "minesweeper",
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
  const record = createMinesweeperPlayRecord({
    difficulty: "3",
    problemIdentity,
    startedAt: 1_000,
    completedAt: 200_000,
    result: { elapsedMs: 150_000, mistakeCount: 0, minimumOpenCount: 25 },
  });

  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createMinesweeperPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({ elapsedMs: 40_000, mistakeCount: 2 });
});

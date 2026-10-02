import {
  createMinesweeperPlayAttempt,
  createMinesweeperPlayAttemptProgress,
  isMinesweeperPlayAttempt,
  minesweeperPlayAttemptDefinition,
} from "@/games/minesweeper/play-attempt";
import {
  createMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "@/games/minesweeper/play-record";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { createMinesweeperSession } from "@/games/minesweeper/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

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

const record = createMinesweeperPlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  result: { elapsedMs: 150_000, mistakeCount: 0, minimumOpenCount: 25 },
});

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
  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createMinesweeperPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({ elapsedMs: 40_000, mistakeCount: 2 });
});

describe("minesweeperPlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createMinesweeperPlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isMinesweeperPlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isMinesweeperPlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      minesweeperPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      minesweeperPlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        minesweeperPlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "mistake-count": 2,
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
    expect(isMinesweeperPlayAttempt(value)).toBe(false);
    expect(minesweeperPlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

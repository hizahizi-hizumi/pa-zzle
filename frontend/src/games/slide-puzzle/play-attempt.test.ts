import {
  createSlidePuzzlePlayAttempt,
  createSlidePuzzlePlayAttemptProgress,
  isSlidePuzzlePlayAttempt,
  slidePuzzlePlayAttemptDefinition,
} from "@/games/slide-puzzle/play-attempt";
import {
  createSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import type { SlidePuzzleProblem } from "@/games/slide-puzzle/problem/problem";
import { createSlidePuzzleSession } from "@/games/slide-puzzle/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

const problemIdentity = {
  generatorVersion: "1",
  seed: "fp30-0",
  conditions: { size: 4, scrambleLength: 30 },
} as const;

const attempt = createSlidePuzzlePlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const problem: SlidePuzzleProblem = {
  initialBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15],
};
const session = {
  ...createSlidePuzzleSession(problem, 1_000),
  moveCount: 12,
  completionMoveCount: 5,
  slideCount: 8,
  restartCount: 1,
};

const record = createSlidePuzzlePlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  result: {
    elapsedMs: 80_000,
    moveCount: 42,
    completionMoveCount: 34,
    slideCount: 25,
    restartCount: 1,
    optimalMoveCount: 30,
  },
});

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "slide-puzzle:1000",
    gameId: "slide-puzzle",
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
  const progress = createSlidePuzzlePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveCount: 12,
    slideCount: 8,
    restartCount: 1,
  });
});

describe("slidePuzzlePlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createSlidePuzzlePlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isSlidePuzzlePlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isSlidePuzzlePlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      slidePuzzlePlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      slidePuzzlePlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        slidePuzzlePlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "move-count": 12,
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
    expect(isSlidePuzzlePlayAttempt(value)).toBe(false);
    expect(slidePuzzlePlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

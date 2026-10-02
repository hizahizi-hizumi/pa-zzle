import {
  createTakuzuPlayAttempt,
  createTakuzuPlayAttemptProgress,
  isTakuzuPlayAttempt,
  takuzuPlayAttemptDefinition,
} from "@/games/takuzu/play-attempt";
import {
  createTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import {
  createTakuzuProblemIdentity,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import { createTakuzuSession } from "@/games/takuzu/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

const problemIdentity = createTakuzuProblemIdentity(
  "duplicate-avoidance",
  2,
  160,
);

const attempt = createTakuzuPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const problem: TakuzuProblem = {
  givens: parseTakuzuBoard(["A..B", "....", "..A.", "B..."]),
  solution: parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BABA"]),
};
const session = {
  ...createTakuzuSession(problem, 1_000),
  settledCorrectionCount: 3,
  restartCount: 1,
  undoCount: 2,
  inputCount: 14,
};

const record = createTakuzuPlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  workload: { emptyCellCount: 46, roundCount: 18, lineReadingRoundCount: 2 },
  result: {
    elapsedMs: 220_000,
    correctionCount: 1,
    restartCount: 0,
    undoCount: 0,
    inputCount: 50,
  },
});

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "takuzu:1000",
    gameId: "takuzu",
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
  const progress = createTakuzuPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    correctionCount: 3,
    restartCount: 1,
    undoCount: 2,
    inputCount: 14,
  });
});

describe("takuzuPlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createTakuzuPlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isTakuzuPlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(true);
    expect(isTakuzuPlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey = takuzuPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      takuzuPlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        takuzuPlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "correction-count": 3,
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
    expect(isTakuzuPlayAttempt(value)).toBe(false);
    expect(takuzuPlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

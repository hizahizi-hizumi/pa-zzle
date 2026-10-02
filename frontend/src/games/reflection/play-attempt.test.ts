import {
  createReflectionPlayAttempt,
  createReflectionPlayAttemptProgress,
  isReflectionPlayAttempt,
  reflectionPlayAttemptDefinition,
} from "@/games/reflection/play-attempt";
import {
  createReflectionPlayRecord,
  reflectionPlayRecordDefinition,
} from "@/games/reflection/play-record";
import {
  createReflectionProblemIdentity,
  type ReflectionProblem,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import { createReflectionSession } from "@/games/reflection/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

const problemIdentity = createReflectionProblemIdentity(6, 11, 3);

const attempt = createReflectionPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const solution = parseReflectionBoard(["/..", "...", "..@"]);
const problem: ReflectionProblem = {
  size: solution.size,
  inventory: countReflectionBoardPieces(solution),
  clues: computeReflectionClues(solution),
  solution,
};
const session = {
  ...createReflectionSession(problem, 1_000),
  relocationCount: 2,
  restartCount: 1,
  laserCheckCount: 4,
  inputCount: 9,
};

const record = createReflectionPlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  workload: {
    pieceCount: 11,
    clueCount: 24,
    propagationRoundCount: 15,
    assumptionTestCount: 8,
    trialMoveCount: null,
  },
  result: {
    elapsedMs: 119_000,
    relocationCount: 2,
    restartCount: 0,
    laserCheckCount: 12,
    inputCount: 30,
  },
});

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "reflection:1000",
    gameId: "reflection",
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
  const progress = createReflectionPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    relocationCount: 2,
    restartCount: 1,
    laserCheckCount: 4,
    inputCount: 9,
  });
});

describe("reflectionPlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createReflectionPlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isReflectionPlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isReflectionPlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      reflectionPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      reflectionPlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        reflectionPlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
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
    expect(isReflectionPlayAttempt(value)).toBe(false);
    expect(reflectionPlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

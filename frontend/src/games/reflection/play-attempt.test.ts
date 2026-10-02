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

const attemptInput: Parameters<typeof createReflectionPlayAttempt>[0] = {
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
};

const attempt = createReflectionPlayAttempt(attemptInput);

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

describe("createReflectionPlayAttempt", () => {
  test("開始条件だけを持つ開始記録を作ること", () => {
    const created = createReflectionPlayAttempt(attemptInput);

    expect(created).toEqual({
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
    expect(created.start.problemIdentity).not.toBe(problemIdentity);
  });

  test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
    const created = createReflectionPlayAttempt(attemptInput);
    const status = getPlayAttemptStatus(created, [record]);

    expect(status).toBe("cleared");
  });
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

function getProgressValues(value: PlayAttempt) {
  return Object.fromEntries(
    reflectionPlayAttemptDefinition.progress.map(({ id, getValue }) => [
      id,
      getValue(value),
    ]),
  );
}

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
  const storedStart: PlayAttempt = JSON.parse(JSON.stringify(attempt));
  const recordComparisonKey =
    reflectionPlayRecordDefinition.getComparisonKey(record);
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
    const readable = isReflectionPlayAttempt(value);

    expect(readable).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      reflectionPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(recordComparisonKey);
  });

  test("離れた時点の進み具合を返すこと", () => {
    const progress = getProgressValues(stored);

    expect(progress).toEqual({
      "elapsed-ms": 40_000,
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
      const readable = isReflectionPlayAttempt(value);
      const comparisonKey =
        reflectionPlayAttemptDefinition.getComparisonKey(value);

      expect(readable).toBe(false);
      expect(comparisonKey).toBeNull();
    },
  );
});

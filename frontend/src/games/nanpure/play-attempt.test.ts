import {
  createNanpurePlayAttempt,
  createNanpurePlayAttemptProgress,
  isNanpurePlayAttempt,
  nanpurePlayAttemptDefinition,
} from "@/games/nanpure/play-attempt";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import {
  createNanpureProblemIdentity,
  type NanpureProblem,
} from "@/games/nanpure/problem/problem";
import type { NanpureCell } from "@/games/nanpure/puzzle/board";
import { createNanpureSession } from "@/games/nanpure/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

const problemIdentity = createNanpureProblemIdentity("locked-candidates", 740);

const attemptInput: Parameters<typeof createNanpurePlayAttempt>[0] = {
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
};

const attempt = createNanpurePlayAttempt(attemptInput);

const solution = [
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
].flatMap((row) => [...row].map((cell) => Number(cell) as NanpureCell));
const problem: NanpureProblem = {
  clues: solution.map((cell, cellIndex) => (cellIndex < 2 ? null : cell)),
  solution: solution as NanpureProblem["solution"],
};
const session = {
  ...createNanpureSession(problem, 1_000),
  mistakeCount: 1,
  undoCount: 3,
  restartCount: 2,
};

const record = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 200_000,
  result: {
    elapsedMs: 120_000,
    mistakeCount: 1,
    undoCount: 2,
    restartCount: 0,
  },
});

describe("createNanpurePlayAttempt", () => {
  test("開始条件だけを持つ開始記録を作ること", () => {
    const created = createNanpurePlayAttempt(attemptInput);

    expect(created).toEqual({
      id: "nanpure:1000",
      gameId: "nanpure",
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
    const created = createNanpurePlayAttempt(attemptInput);
    const status = getPlayAttemptStatus(created, [record]);

    expect(status).toBe("cleared");
  });
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createNanpurePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    mistakeCount: 1,
    undoCount: 3,
    restartCount: 2,
  });
});

function getProgressValues(value: PlayAttempt) {
  return Object.fromEntries(
    nanpurePlayAttemptDefinition.progress.map(({ id, getValue }) => [
      id,
      getValue(value),
    ]),
  );
}

describe("nanpurePlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createNanpurePlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));
  const storedStart: PlayAttempt = JSON.parse(JSON.stringify(attempt));
  const recordComparisonKey =
    nanpurePlayRecordDefinition.getComparisonKey(record);
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
    const readable = isNanpurePlayAttempt(value);

    expect(readable).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey = nanpurePlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(recordComparisonKey);
  });

  test("離れた時点の進み具合を返すこと", () => {
    const progress = getProgressValues(stored);

    expect(progress).toEqual({
      "elapsed-ms": 40_000,
      "mistake-count": 1,
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
      const readable = isNanpurePlayAttempt(value);
      const comparisonKey =
        nanpurePlayAttemptDefinition.getComparisonKey(value);

      expect(readable).toBe(false);
      expect(comparisonKey).toBeNull();
    },
  );
});

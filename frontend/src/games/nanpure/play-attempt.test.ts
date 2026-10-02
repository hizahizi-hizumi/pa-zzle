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

const attempt = createNanpurePlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

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

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
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
  expect(attempt.start.problemIdentity).not.toBe(problemIdentity);
});

test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
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

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isNanpurePlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isNanpurePlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey = nanpurePlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      nanpurePlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        nanpurePlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "mistake-count": 1,
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
    expect(isNanpurePlayAttempt(value)).toBe(false);
    expect(nanpurePlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});

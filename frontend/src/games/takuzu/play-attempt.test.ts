import {
  createTakuzuPlayAttempt,
  createTakuzuPlayAttemptProgress,
} from "@/games/takuzu/play-attempt";
import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import {
  createTakuzuProblemIdentity,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import { createTakuzuSession } from "@/games/takuzu/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

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

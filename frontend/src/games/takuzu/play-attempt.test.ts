import { createTakuzuPlayAttemptProgress } from "@/games/takuzu/play-attempt";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import { createTakuzuSession } from "@/games/takuzu/session/session";

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

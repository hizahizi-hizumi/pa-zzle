import { createReflectionPlayAttemptProgress } from "@/games/reflection/play-attempt";
import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import { createReflectionSession } from "@/games/reflection/session/session";

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

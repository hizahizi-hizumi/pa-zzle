import { createSlidePuzzlePlayAttemptProgress } from "@/games/slide-puzzle/play-attempt";
import type { SlidePuzzleProblem } from "@/games/slide-puzzle/problem/problem";
import { createSlidePuzzleSession } from "@/games/slide-puzzle/session/session";

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

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createSlidePuzzlePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveCount: 12,
    slideCount: 8,
    restartCount: 1,
  });
});

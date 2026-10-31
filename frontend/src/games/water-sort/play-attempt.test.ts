import { createWaterSortPlayAttemptProgress } from "@/games/water-sort/play-attempt";
import type { WaterSortProblem } from "@/games/water-sort/problem/problem";
import { createWaterSortSession } from "@/games/water-sort/session/session";

const problem: WaterSortProblem = {
  initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
};
const session = {
  ...createWaterSortSession(problem, 1_000),
  moveCount: 7,
  undoCount: 2,
  restartCount: 1,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createWaterSortPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveCount: 7,
    undoCount: 2,
    restartCount: 1,
  });
});

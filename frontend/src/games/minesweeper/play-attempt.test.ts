import { createMinesweeperPlayAttemptProgress } from "@/games/minesweeper/play-attempt";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { createMinesweeperSession } from "@/games/minesweeper/session/session";

const problem: MinesweeperProblem = {
  board: { rows: 2, columns: 3, mineCellIndices: [0] },
  initialRevealedCellIndices: [1],
};
const session = {
  ...createMinesweeperSession(problem, 1_000),
  mistakeCount: 2,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createMinesweeperPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({ elapsedMs: 40_000, mistakeCount: 2 });
});

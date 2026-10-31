import { createIceFloorMazePlayAttemptProgress } from "@/games/ice-floor-maze/play-attempt";
import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { createIceFloorMazeSession } from "@/games/ice-floor-maze/session/session";

const problem: IceFloorMazeProblem = {
  board: parseIceFloorMazeBoard(["..#.", "....", "....", "...."]),
  start: 0,
  goal: 1,
};
const session = {
  ...createIceFloorMazeSession(problem, 1_000),
  moveCount: 12,
  undoCount: 3,
  restartCount: 1,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createIceFloorMazePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveCount: 12,
    undoCount: 3,
    restartCount: 1,
  });
});

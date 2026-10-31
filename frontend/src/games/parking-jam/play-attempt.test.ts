import { createParkingJamPlayAttemptProgress } from "@/games/parking-jam/play-attempt";
import type { ParkingJamProblem } from "@/games/parking-jam/problem/problem";
import { createParkingJamSession } from "@/games/parking-jam/session/session";

const problem: ParkingJamProblem = {
  board: {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 1, column: 0, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [{ side: "right", startOffset: 1, length: 1 }],
  },
};
const session = {
  ...createParkingJamSession(problem, 1_000),
  moveAttemptCount: 5,
  successfulMoveCount: 4,
  failedMoveCount: 1,
  undoCount: 2,
  restartCount: 1,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createParkingJamPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveAttemptCount: 5,
    successfulMoveCount: 4,
    failedMoveCount: 1,
    undoCount: 2,
    restartCount: 1,
  });
});

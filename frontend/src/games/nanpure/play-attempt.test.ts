import { createNanpurePlayAttemptProgress } from "@/games/nanpure/play-attempt";
import type { NanpureProblem } from "@/games/nanpure/problem/problem";
import type { NanpureCell } from "@/games/nanpure/puzzle/board";
import { createNanpureSession } from "@/games/nanpure/session/session";

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

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createNanpurePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    mistakeCount: 1,
    undoCount: 3,
    restartCount: 2,
  });
});

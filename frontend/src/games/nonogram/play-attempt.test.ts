import { createNonogramPlayAttemptProgress } from "@/games/nonogram/play-attempt";
import { createNonogramProblem } from "@/games/nonogram/problem/problem";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import {
  createNonogramSession,
  startNonogramSessionStroke,
} from "@/games/nonogram/session/session";

const problem = createNonogramProblem(
  parseNonogramPattern(["#.#", "###", ".#."]),
);
const session = startNonogramSessionStroke(
  {
    ...createNonogramSession(problem, 1_000),
    settledRepaintCount: 3,
    settledCrossToggleCount: 5,
    undoCount: 2,
    restartCount: 1,
    inputCount: 14,
  },
  1,
  "crossed",
  30_000,
);

test("離れた時点までの、入力中のマスを含めた実測値を進み具合にすること", () => {
  const progress = createNonogramPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    repaintCount: 3,
    crossToggleCount: 6,
    undoCount: 2,
    restartCount: 1,
    inputCount: 15,
  });
});

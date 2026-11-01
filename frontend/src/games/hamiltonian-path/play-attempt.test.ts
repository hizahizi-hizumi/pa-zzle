import { createHamiltonianPathPlayAttemptProgress } from "@/games/hamiltonian-path/play-attempt";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import {
  createHamiltonianPathSession,
  extendHamiltonianPathSessionPath,
} from "@/games/hamiltonian-path/session/session";

/**
 * 右下が穴の 3×3 の盤面。道が通るマスは8つ。
 * 0 1 2
 * 3 4 5
 * 6 7 #
 */
const problem = parseHamiltonianPathBoard(["S . .", ". . .", ". . #"]);
const session = {
  ...extendHamiltonianPathSessionPath(
    createHamiltonianPathSession(problem, 1_000),
    1,
    1_000,
  ).session,
  backtrackCount: 2,
  retractedCellCount: 5,
  undoCount: 1,
  restartCount: 1,
  inputCount: 9,
};

test("離れた時点までの実測値と、道が通ったマスと通るマスの数を進み具合にすること", () => {
  const progress = createHamiltonianPathPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    visitedCellCount: 2,
    openCellCount: 8,
    backtrackCount: 2,
    retractedCellCount: 5,
    undoCount: 1,
    restartCount: 1,
    inputCount: 9,
  });
});

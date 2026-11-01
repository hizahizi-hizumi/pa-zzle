import { createHitofudePuzzlePlayAttemptProgress } from "@/games/hitofude-puzzle/play-attempt";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import {
  createHitofudePuzzleSession,
  extendHitofudePuzzleSessionPath,
} from "@/games/hitofude-puzzle/session/session";

/**
 * 右下が穴の 3×3 の盤面。道が通るマスは8つ。
 * 0 1 2
 * 3 4 5
 * 6 7 #
 */
const problem = parseHitofudePuzzleBoard(["S . .", ". . .", ". . #"]);
const session = {
  ...extendHitofudePuzzleSessionPath(
    createHitofudePuzzleSession(problem, 1_000),
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
  const progress = createHitofudePuzzlePlayAttemptProgress(session, 41_000);

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

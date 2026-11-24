import { createSolitairePlayAttemptProgress } from "@/games/solitaire/play-attempt";
import {
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import { createSolitaireSession } from "@/games/solitaire/session/session";

const { problem } = restoreSolitairePoolEntry(
  listSolitairePoolEntries("1")[0]!,
);
const session = {
  ...createSolitaireSession(problem, 1_000),
  moveCount: 40,
  undoCount: 6,
  restartCount: 1,
  retractedMoveCount: 9,
};

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createSolitairePlayAttemptProgress(session, 61_000);

  expect(progress).toEqual({
    elapsedMs: 60_000,
    moveCount: 40,
    undoCount: 6,
    restartCount: 1,
    retractedMoveCount: 9,
  });
});

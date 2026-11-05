import { createBridgesPlayAttemptProgress } from "@/games/bridges/play-attempt";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import {
  createBridgesSession,
  cycleBridgesSessionEdge,
} from "@/games/bridges/session/session";

/**
 * 6×6 の左上の3島。解は上の2島に2本、左の2島に1本で、要る橋は3本。
 * 3.2...
 * ......
 * 1.....
 */
const problem = parseBridgesBoard([
  "3.2...",
  "......",
  "1.....",
  "......",
  "......",
  "......",
]);
const placed = cycleBridgesSessionEdge(
  cycleBridgesSessionEdge(createBridgesSession(problem, 1_000), 0, 1_000)
    .session,
  0,
  1_000,
).session;
const session = {
  ...placed,
  undoCount: 1,
  restartCount: 1,
  blockedCount: 2,
};

test("離れた時点までの実測値と、架けていた橋と要る橋の本数を進み具合にすること", () => {
  const progress = createBridgesPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    placedBridgeCount: 2,
    requiredBridgeCount: 3,
    undoCount: 1,
    restartCount: 1,
    inputCount: 2,
    blockedCount: 2,
  });
});

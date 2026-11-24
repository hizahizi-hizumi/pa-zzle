import { createShuttleParkingPlayAttemptProgress } from "@/games/shuttle-parking/play-attempt";
import {
  listShuttleParkingPoolEntries,
  restoreShuttleParkingPoolEntry,
} from "@/games/shuttle-parking/problem/problem-pool";
import { listShuttleParkingExitableCarIds } from "@/games/shuttle-parking/puzzle/rules";
import {
  attemptShuttleParkingSessionExit,
  createShuttleParkingSession,
} from "@/games/shuttle-parking/session/session";

describe("createShuttleParkingPlayAttemptProgress", () => {
  const { problem } = restoreShuttleParkingPoolEntry(
    listShuttleParkingPoolEntries("1")[0]!,
  );
  const started = createShuttleParkingSession(problem, 1_000);
  const [carId] = listShuttleParkingExitableCarIds(
    problem,
    started.puzzleState,
  );
  const session = attemptShuttleParkingSessionExit(
    started,
    carId!,
    2_000,
  ).session;

  test("離れた時点までの時間と回数を返すこと", () => {
    const progress = createShuttleParkingPlayAttemptProgress(session, 9_000);

    expect(progress).toEqual({
      elapsedMs: 8_000,
      boardedCount: session.puzzleState.boardedCount,
      exitCount: 1,
      blockedExitCount: 0,
      trapCount: session.trapCount,
      undoCount: 0,
      restartCount: 0,
    });
  });
});

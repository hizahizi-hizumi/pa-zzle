import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import {
  attemptShuttleParkingSessionExit,
  canRestartShuttleParkingSession,
  canUndoShuttleParkingSession,
  createShuttleParkingSession,
  getShuttleParkingSessionResult,
  restartShuttleParkingSession,
  type ShuttleParkingSession,
  undoShuttleParkingSession,
} from "@/games/shuttle-parking/session/session";

// 4×4・上だけが開いている。赤の車0が青の車1を塞ぐ。待機枠は1つなので、先頭の赤を待たせずに青の車2を出すと詰む。
const problem: ShuttleParkingProblem = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
    ],
  },
  passengers: ["a", "a", "b", "b", "b", "b"],
  bayCount: 1,
};
const startedAt = 1_000;

function exitInOrder(
  session: ShuttleParkingSession,
  carIds: readonly number[],
  attemptedAt = startedAt + 10_000,
): ShuttleParkingSession {
  return carIds.reduce(
    (current, carId) =>
      attemptShuttleParkingSessionExit(current, carId, attemptedAt).session,
    session,
  );
}

describe("createShuttleParkingSession", () => {
  test("全部の車が駐車場にあるプレイ中の状態で始めること", () => {
    const session = createShuttleParkingSession(problem, startedAt);

    expect(session).toMatchObject({
      status: "playing",
      puzzleState: {
        parkedCarIds: [0, 1, 2],
        waitingCars: [],
        boardedCount: 0,
      },
      exitCount: 0,
      blockedExitCount: 0,
      trapCount: 0,
    });
  });

  test("乗客と座席が合わない問題を受け付けないこと", () => {
    function create() {
      return createShuttleParkingSession(
        { ...problem, passengers: ["a"] },
        startedAt,
      );
    }

    expect(create).toThrow(RangeError);
  });
});

describe("attemptShuttleParkingSessionExit", () => {
  describe("進路を塞がれた車の場合", () => {
    const session = createShuttleParkingSession(problem, startedAt);

    test("盤面を変えずに出られなかった回数を数えること", () => {
      const attempt = attemptShuttleParkingSessionExit(session, 1, startedAt);

      expect(attempt).toMatchObject({
        outcome: "blocked",
        reason: "path-blocked",
        blockerIds: [0],
      });
      expect(attempt.session.puzzleState).toBe(session.puzzleState);
      expect(attempt.session.blockedExitCount).toBe(1);
    });
  });

  describe("全員を送り出せなくなる車を出した場合", () => {
    const session = createShuttleParkingSession(problem, startedAt);

    test("罠に入った回数を数えること", () => {
      const attempt = attemptShuttleParkingSessionExit(session, 2, startedAt);

      expect(attempt.outcome).toBe("exited");
      expect(attempt.session.trapCount).toBe(1);
    });
  });

  describe("待機枠が2つの場合", () => {
    const session = createShuttleParkingSession(
      { ...problem, bayCount: 2 },
      startedAt,
    );

    test("先に車2を出しても、車0で赤を運べるので罠に数えないこと", () => {
      const attempt = attemptShuttleParkingSessionExit(session, 2, startedAt);

      expect(attempt.session.trapCount).toBe(0);
    });
  });

  describe("最後の車を出した場合", () => {
    const session = exitInOrder(
      createShuttleParkingSession(problem, startedAt),
      [0, 2],
    );

    test("出した時刻でクリアにすること", () => {
      const attempt = attemptShuttleParkingSessionExit(
        session,
        1,
        startedAt + 30_000,
      );

      expect(attempt.outcome).toBe("exited");
      expect(attempt.session).toMatchObject({
        status: "cleared",
        clearedAt: startedAt + 30_000,
        exitCount: 3,
      });
    });
  });

  describe("クリアした後の場合", () => {
    const session = exitInOrder(
      createShuttleParkingSession(problem, startedAt),
      [0, 2, 1],
    );

    test("受け付けないこと", () => {
      const attempt = attemptShuttleParkingSessionExit(session, 0, startedAt);

      expect(attempt).toEqual({ outcome: "ignored", carId: 0, session });
    });
  });
});

describe("undoShuttleParkingSession", () => {
  const session = exitInOrder(
    createShuttleParkingSession(problem, startedAt),
    [2],
  );

  test("1台前の盤面に戻し、罠の回数は残すこと", () => {
    const undone = undoShuttleParkingSession(session);

    expect(undone.puzzleState.parkedCarIds).toEqual([0, 1, 2]);
    expect(undone).toMatchObject({ undoCount: 1, trapCount: 1 });
    expect(canUndoShuttleParkingSession(undone)).toBe(false);
  });

  test("戻して同じ盤面から同じ車をもう一度出しても、罠の回数を増やさないこと", () => {
    const again = exitInOrder(undoShuttleParkingSession(session), [2]);

    expect(again.trapCount).toBe(1);
  });

  test("盤面を戻して同じ罠に入っても、罠の回数を増やさないこと", () => {
    const again = exitInOrder(restartShuttleParkingSession(session), [2]);

    expect(again.trapCount).toBe(1);
  });
});

describe("restartShuttleParkingSession", () => {
  describe("車を出した後の場合", () => {
    const session = exitInOrder(
      createShuttleParkingSession(problem, startedAt),
      [0, 2],
    );

    test("最初の盤面に戻し、時間と回数を残すこと", () => {
      const restarted = restartShuttleParkingSession(session);

      expect(restarted.puzzleState.parkedCarIds).toEqual([0, 1, 2]);
      expect(restarted).toMatchObject({
        startedAt,
        exitCount: 2,
        restartCount: 1,
      });
    });
  });

  describe("最初の盤面の場合", () => {
    const session = createShuttleParkingSession(problem, startedAt);

    test("何もせず回数も数えないこと", () => {
      const restarted = restartShuttleParkingSession(session);

      expect(restarted).toBe(session);
      expect(canRestartShuttleParkingSession(session)).toBe(false);
    });
  });
});

describe("getShuttleParkingSessionResult", () => {
  test("プレイ中は結果を返さないこと", () => {
    const result = getShuttleParkingSessionResult(
      createShuttleParkingSession(problem, startedAt),
    );

    expect(result).toBeNull();
  });

  describe("罠に入って待ったで戻してからクリアした場合", () => {
    const session = exitInOrder(
      undoShuttleParkingSession(
        exitInOrder(createShuttleParkingSession(problem, startedAt), [2]),
      ),
      [0, 2, 1],
      startedAt + 20_000,
    );

    test("クリアまでの時間と回数を返すこと", () => {
      const result = getShuttleParkingSessionResult(session);

      expect(result).toEqual({
        elapsedMs: 20_000,
        exitCount: 4,
        blockedExitCount: 0,
        trapCount: 1,
        undoCount: 1,
        restartCount: 0,
      });
    });
  });
});

import type { ParkingJamProblem } from "../problem/problem";
import {
  attemptParkingJamSessionMove,
  canRestartParkingJamSession,
  canUndoParkingJamSession,
  createParkingJamSession,
  getParkingJamSessionResult,
  type ParkingJamSession,
  restartParkingJamSession,
  undoParkingJamSession,
} from "./session";

const problem: ParkingJamProblem = {
  board: {
    width: 5,
    height: 5,
    vehicles: [
      {
        id: "a",
        row: 1,
        column: 0,
        orientation: "horizontal",
        length: 2,
      },
      {
        id: "b",
        row: 0,
        column: 3,
        orientation: "vertical",
        length: 2,
      },
    ],
    obstacles: [],
    exits: [
      { side: "right", offset: 1 },
      { side: "up", offset: 3 },
    ],
  },
};

const startedAt = 1_000;

function exitVehicleB(session: ParkingJamSession): ParkingJamSession {
  const attempt = attemptParkingJamSessionMove(
    session,
    { vehicleId: "b", direction: "up" },
    2_000,
  );
  if (attempt?.outcome !== "exited") {
    throw new Error("Expected vehicle b to exit");
  }
  return attempt.session;
}

describe("attemptParkingJamSessionMove", () => {
  let session: ParkingJamSession;

  beforeEach(() => {
    session = createParkingJamSession(problem, startedAt);
  });

  describe("別の車に進路を塞がれている場合", () => {
    test("盤面を変えず不成立操作として記録すること", () => {
      const attempt = attemptParkingJamSessionMove(
        session,
        { vehicleId: "a", direction: "right" },
        1_500,
      );

      expect(attempt?.outcome).toBe("blocked");
      expect(attempt?.session.state).toEqual(session.state);
      expect(attempt?.session.moveAttemptCount).toBe(1);
      expect(attempt?.session.failedMoveCount).toBe(1);
    });
  });

  describe("出庫できる方向を選んだ場合", () => {
    test("車を取り除き成功操作として記録すること", () => {
      const attempt = attemptParkingJamSessionMove(
        session,
        { vehicleId: "b", direction: "up" },
        2_000,
      );

      expect(attempt?.outcome).toBe("exited");
      expect(attempt?.session.state.remainingVehicleIds).toEqual(["a"]);
      expect(attempt?.session.moveAttemptCount).toBe(1);
      expect(attempt?.session.successfulMoveCount).toBe(1);
      expect(attempt?.session.failedMoveCount).toBe(0);
    });
  });

  describe("最後の車を出庫した場合", () => {
    beforeEach(() => {
      session = exitVehicleB(session);
    });

    test("クリア時刻と完了事実を確定すること", () => {
      const attempt = attemptParkingJamSessionMove(
        session,
        { vehicleId: "a", direction: "right" },
        4_000,
      );
      const result = attempt
        ? getParkingJamSessionResult(attempt.session, 9_000)
        : null;

      expect(attempt?.session.status).toBe("cleared");
      expect(result).toEqual({
        elapsedMs: 3_000,
        moveAttemptCount: 2,
        successfulMoveCount: 2,
        failedMoveCount: 0,
        undoCount: 0,
        restartCount: 0,
      });
    });
  });
});

describe("undoParkingJamSession", () => {
  let session: ParkingJamSession;

  beforeEach(() => {
    session = exitVehicleB(createParkingJamSession(problem, startedAt));
  });

  test("直前に出庫した車を盤面へ戻すこと", () => {
    const restored = undoParkingJamSession(session);

    expect(restored.state.remainingVehicleIds).toEqual(["a", "b"]);
    expect(restored.undoCount).toBe(1);
    expect(canUndoParkingJamSession(restored)).toBe(false);
  });
});

describe("restartParkingJamSession", () => {
  describe("まだ盤面が変化していない場合", () => {
    let session: ParkingJamSession;

    beforeEach(() => {
      session = createParkingJamSession(problem, startedAt);
    });

    test("やり直し可能として扱わないこと", () => {
      const restarted = restartParkingJamSession(session);

      expect(canRestartParkingJamSession(session)).toBe(false);
      expect(restarted).toBe(session);
    });
  });

  let session: ParkingJamSession;

  beforeEach(() => {
    session = exitVehicleB(createParkingJamSession(problem, startedAt));
  });

  test("同じ問題の初期盤面へ戻してやり直し回数を記録すること", () => {
    const restarted = restartParkingJamSession(session);

    expect(restarted.state.remainingVehicleIds).toEqual(["a", "b"]);
    expect(restarted.history).toEqual([]);
    expect(restarted.restartCount).toBe(1);
    expect(canRestartParkingJamSession(session)).toBe(true);
  });
});

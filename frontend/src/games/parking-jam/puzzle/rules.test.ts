import { createParkingJamInitialState, type ParkingJamBoard } from "./board";
import {
  applyParkingJamMove,
  listParkingJamLegalMoves,
  listParkingJamMoveBlockers,
} from "./rules";

describe("listParkingJamMoveBlockers", () => {
  const board: ParkingJamBoard = {
    width: 6,
    height: 6,
    vehicles: [
      { id: "a", row: 2, column: 1, orientation: "horizontal", length: 2 },
      { id: "b", row: 2, column: 4, orientation: "vertical", length: 2 },
    ],
    fixedAreas: [{ row: 2, column: 0, width: 1, height: 1 }],
    roadOpenings: [
      { side: "left", startOffset: 2, length: 1 },
      { side: "right", startOffset: 2, length: 1 },
    ],
  };
  const state = createParkingJamInitialState(board);

  test("進行方向にいる車を遮断車として返すこと", () => {
    const blockers = listParkingJamMoveBlockers(board, state, {
      vehicleId: "a",
      direction: "right",
    });

    expect(blockers).toEqual([{ kind: "vehicle", vehicleId: "b" }]);
  });

  test("進行方向にある障害物を返すこと", () => {
    const blockers = listParkingJamMoveBlockers(board, state, {
      vehicleId: "a",
      direction: "left",
    });

    expect(blockers).toEqual([
      { kind: "fixed-area", cell: { row: 2, column: 0 } },
    ]);
  });
});

describe("applyParkingJamMove", () => {
  const board: ParkingJamBoard = {
    width: 4,
    height: 4,
    vehicles: [
      { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [{ side: "right", startOffset: 1, length: 1 }],
  };
  const state = createParkingJamInitialState(board);

  test("合法な出庫で車を盤面状態から取り除くこと", () => {
    const nextState = applyParkingJamMove(board, state, {
      vehicleId: "a",
      direction: "right",
    });

    expect(nextState).toEqual({ remainingVehicleIds: [] });
  });

  test("壁へ向かう操作では盤面状態を変更しないこと", () => {
    const nextState = applyParkingJamMove(board, state, {
      vehicleId: "a",
      direction: "left",
    });

    expect(nextState).toBeNull();
  });
});

describe("listParkingJamLegalMoves", () => {
  const board: ParkingJamBoard = {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
      { id: "b", row: 3, column: 1, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [
      { side: "left", startOffset: 1, length: 1 },
      { side: "right", startOffset: 3, length: 1 },
    ],
  };
  const state = createParkingJamInitialState(board);

  test("現在出庫できる車と方向だけを列挙すること", () => {
    const moves = listParkingJamLegalMoves(board, state);

    expect(moves).toEqual([
      { vehicleId: "a", direction: "left" },
      { vehicleId: "b", direction: "right" },
    ]);
  });
});

describe("連続した道路開口の場合", () => {
  const board: ParkingJamBoard = {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
      { id: "b", row: 2, column: 1, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [{ side: "right", startOffset: 1, length: 2 }],
  };
  const state = createParkingJamInitialState(board);

  test("開口区間に含まれる各レーンから出庫できること", () => {
    const moves = listParkingJamLegalMoves(board, state);

    expect(moves).toEqual([
      { vehicleId: "a", direction: "right" },
      { vehicleId: "b", direction: "right" },
    ]);
  });
});

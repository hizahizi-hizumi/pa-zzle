import {
  createParkingJamInitialState,
  type ParkingJamBoard,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  findParkingJamExitContact,
  listParkingJamLegalMoves,
  listParkingJamMoveBlockers,
} from "@/games/parking-jam/puzzle/rules";

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

describe("findParkingJamExitContact", () => {
  const board: ParkingJamBoard = {
    width: 6,
    height: 3,
    vehicles: [
      { id: "a", row: 1, column: 2, orientation: "horizontal", length: 2 },
      { id: "b", row: 0, column: 0, orientation: "vertical", length: 2 },
      { id: "c", row: 0, column: 4, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [{ row: 1, column: 5, width: 1, height: 1 }],
    roadOpenings: [
      { side: "left", startOffset: 0, length: 1 },
      { side: "right", startOffset: 1, length: 1 },
    ],
  };
  const state = createParkingJamInitialState(board);
  const stateWithoutB = { remainingVehicleIds: ["a", "c"] };

  const blockedCases = [
    [
      "道路につながっていない車線では、途中の車より先に外周を示す",
      { vehicleId: "a", direction: "left" },
      { blocker: { kind: "wall" }, freeCellCount: 2 },
    ],
    [
      "途中に何もなく道路につながっていない車線では、外周を示す",
      { vehicleId: "c", direction: "right" },
      { blocker: { kind: "wall" }, freeCellCount: 0 },
    ],
    [
      "道路につながっている車線では、途中で最初に当たる植え込みを示す",
      { vehicleId: "a", direction: "right" },
      {
        blocker: { kind: "fixed-area", cell: { row: 1, column: 5 } },
        freeCellCount: 1,
      },
    ],
    [
      "道路につながっている車線では、途中で最初に当たる車を示す",
      { vehicleId: "c", direction: "left" },
      { blocker: { kind: "vehicle", vehicleId: "b" }, freeCellCount: 3 },
    ],
  ] as const;

  test.each(blockedCases)("%sこと", (_, move, expected) => {
    const contact = findParkingJamExitContact(board, state, move);

    expect(contact).toEqual(expected);
  });

  test.each(blockedCases)(
    "示すものが listParkingJamMoveBlockers の返すわけに含まれること: %s",
    (_, move) => {
      const contact = findParkingJamExitContact(board, state, move);
      const blockers = listParkingJamMoveBlockers(board, state, move);

      expect(blockers).toContainEqual(contact?.blocker);
    },
  );

  test("出られる手では何も返さないこと", () => {
    const contact = findParkingJamExitContact(board, stateWithoutB, {
      vehicleId: "c",
      direction: "left",
    });

    expect(contact).toBeNull();
  });
});

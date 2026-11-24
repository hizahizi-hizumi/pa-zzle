import {
  assertShuttleParkingPuzzle,
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  isShuttleParkingStuck,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

// 4×4、上だけが開いている。車0（a・2人）が車1（b・2人）の上を塞ぐ。車2（b・2人）はすぐ出られる。
const puzzle: ShuttleParkingPuzzle = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
    ],
  },
  passengers: ["b", "a", "b", "a", "b", "b"],
  bayCount: 2,
};

function exitInOrder(
  target: ShuttleParkingPuzzle,
  carIds: readonly number[],
): ShuttleParkingState {
  return carIds.reduce((state, carId) => {
    const exit = exitShuttleParkingCar(target, state, carId);
    if (exit.outcome !== "exited") throw new Error(`car ${carId} must exit`);
    return exit.state;
  }, createShuttleParkingInitialState(target));
}

describe("exitShuttleParkingCar", () => {
  describe("進路を塞がれた車の場合", () => {
    const state = createShuttleParkingInitialState(puzzle);

    test("盤面を変えず、塞いでいる車を返すこと", () => {
      const exit = exitShuttleParkingCar(puzzle, state, 1);

      expect(exit).toEqual({
        outcome: "blocked",
        reason: "path-blocked",
        blockerIds: [0],
      });
    });
  });

  describe("列の先頭と違う色の車の場合", () => {
    const state = createShuttleParkingInitialState(puzzle);

    test("待機枠に入り、誰も乗らないこと", () => {
      const exit = exitShuttleParkingCar(puzzle, state, 0);

      expect(exit).toEqual({
        outcome: "exited",
        side: "top",
        state: {
          parkedCarIds: [1, 2],
          waitingCars: [{ carId: 0, seatedCount: 0 }],
          boardedCount: 0,
        },
        events: [],
      });
    });
  });

  describe("待機枠に乗れる車がそろった場合", () => {
    const state = exitInOrder(puzzle, [0]);

    test("先頭から1人ずつ同じ色の車へ乗り、満席の車から出発すること", () => {
      const exit = exitShuttleParkingCar(puzzle, state, 2);

      expect(exit).toEqual({
        outcome: "exited",
        side: "top",
        state: { parkedCarIds: [1], waitingCars: [], boardedCount: 4 },
        events: [
          { type: "boarded", passengerIndex: 0, carId: 2 },
          { type: "boarded", passengerIndex: 1, carId: 0 },
          { type: "boarded", passengerIndex: 2, carId: 2 },
          { type: "departed", carId: 2 },
          { type: "boarded", passengerIndex: 3, carId: 0 },
          { type: "departed", carId: 0 },
        ],
      });
    });
  });

  describe("同じ色の車が2台待っている場合", () => {
    // 先頭の c の車3を最後に出すと、それまでの3台は誰も乗せずに待つ。b の車は2が先、1が後に入る。
    const sameColorPuzzle: ShuttleParkingPuzzle = {
      lot: {
        ...puzzle.lot,
        cars: [
          ...puzzle.lot.cars,
          {
            row: 0,
            column: 3,
            orientation: "vertical",
            capacity: 2,
            color: "c",
          },
        ],
      },
      passengers: ["c", "b", "b", "b", "a", "a", "b", "c"],
      bayCount: 4,
    };
    const state = exitInOrder(sameColorPuzzle, [0, 2, 1]);

    test("先に入った車から座席を埋めること", () => {
      const exit = exitShuttleParkingCar(sameColorPuzzle, state, 3);

      expect(exit.outcome === "exited" && exit.events).toEqual([
        { type: "boarded", passengerIndex: 0, carId: 3 },
        { type: "boarded", passengerIndex: 1, carId: 2 },
        { type: "boarded", passengerIndex: 2, carId: 2 },
        { type: "departed", carId: 2 },
        { type: "boarded", passengerIndex: 3, carId: 1 },
        { type: "boarded", passengerIndex: 4, carId: 0 },
        { type: "boarded", passengerIndex: 5, carId: 0 },
        { type: "departed", carId: 0 },
        { type: "boarded", passengerIndex: 6, carId: 1 },
        { type: "departed", carId: 1 },
        { type: "boarded", passengerIndex: 7, carId: 3 },
        { type: "departed", carId: 3 },
      ]);
    });
  });

  describe("待機枠が埋まっている場合", () => {
    const narrowPuzzle = { ...puzzle, bayCount: 1 };
    const state = exitInOrder(narrowPuzzle, [0]);

    test("進路が空いた車も出せないこと", () => {
      const exit = exitShuttleParkingCar(narrowPuzzle, state, 1);

      expect(exit).toEqual({ outcome: "blocked", reason: "bays-full" });
    });
  });

  describe("出た後の車の場合", () => {
    const state = exitInOrder(puzzle, [0]);

    test("受け付けないこと", () => {
      const exit = exitShuttleParkingCar(puzzle, state, 0);

      expect(exit).toEqual({ outcome: "not-parked" });
    });
  });
});

describe("listShuttleParkingExitableCarIds", () => {
  test.each([
    ["最初の盤面", [], [0, 2]],
    ["車0を出した後", [0], [1, 2]],
  ] as const)("%sでは進路が空いた車を返すこと", (_, order, expected) => {
    const state = exitInOrder(puzzle, order);

    const carIds = listShuttleParkingExitableCarIds(puzzle, state);

    expect(carIds).toEqual(expected);
  });
});

describe("isShuttleParkingCleared", () => {
  test.each([
    ["全員を送り出した", [0, 2, 1], true],
    ["車が残っている", [0, 2], false],
  ] as const)("%s盤面で %s を返すこと", (_, order, expected) => {
    const state = exitInOrder(puzzle, order);

    const cleared = isShuttleParkingCleared(puzzle, state);

    expect(cleared).toBe(expected);
  });
});

describe("isShuttleParkingStuck", () => {
  const narrowPuzzle = { ...puzzle, bayCount: 1 };

  test.each([
    ["待機枠が埋まり出せる車が無い", narrowPuzzle, [0], true],
    ["出せる車がある", puzzle, [0], false],
    ["クリアした", puzzle, [0, 2, 1], false],
  ] as const)("%s盤面で %s を返すこと", (_, target, order, expected) => {
    const state = exitInOrder(target, order);

    const stuck = isShuttleParkingStuck(target, state);

    expect(stuck).toBe(expected);
  });
});

describe("assertShuttleParkingPuzzle", () => {
  test.each([
    ["乗客と座席の数が色ごとに合わない", { ...puzzle, passengers: ["a", "b"] }],
    ["待機枠が無い", { ...puzzle, bayCount: 0 }],
    [
      "車が無い",
      { ...puzzle, lot: { ...puzzle.lot, cars: [] }, passengers: [] },
    ],
  ] as const satisfies readonly (readonly [string, ShuttleParkingPuzzle])[])(
    "%s問題を受け付けないこと",
    (_, target) => {
      function assertPuzzle() {
        assertShuttleParkingPuzzle(target);
      }

      expect(assertPuzzle).toThrow(RangeError);
    },
  );
});

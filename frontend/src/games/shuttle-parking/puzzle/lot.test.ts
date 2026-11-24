import {
  assertShuttleParkingLot,
  listShuttleParkingCarCells,
  listShuttleParkingCarExitSides,
  listShuttleParkingPathCells,
  type ShuttleParkingCar,
  type ShuttleParkingLot,
} from "@/games/shuttle-parking/puzzle/lot";

const verticalCar: ShuttleParkingCar = {
  row: 1,
  column: 2,
  orientation: "vertical",
  capacity: 3,
  color: "a",
};
const horizontalCar: ShuttleParkingCar = {
  row: 0,
  column: 1,
  orientation: "horizontal",
  capacity: 2,
  color: "b",
};

describe("listShuttleParkingCarCells", () => {
  test("向きに沿って定員と同じ数のマスを占めること", () => {
    const cells = listShuttleParkingCarCells(verticalCar);

    expect(cells).toEqual([
      { row: 1, column: 2 },
      { row: 2, column: 2 },
      { row: 3, column: 2 },
    ]);
  });
});

describe("listShuttleParkingPathCells", () => {
  const lot: ShuttleParkingLot = {
    size: 6,
    openSides: ["top"],
    cars: [verticalCar],
  };

  test.each([
    ["top", [{ row: 0, column: 2 }]],
    [
      "bottom",
      [
        { row: 4, column: 2 },
        { row: 5, column: 2 },
      ],
    ],
  ] as const)("%s への進路を車に近い順に返すこと", (side, expected) => {
    const cells = listShuttleParkingPathCells(lot, verticalCar, side);

    expect(cells).toEqual(expected);
  });

  test("横の車の右への進路は同じ行の右側のマスであること", () => {
    const cells = listShuttleParkingPathCells(lot, horizontalCar, "right");

    expect(cells).toEqual([
      { row: 0, column: 3 },
      { row: 0, column: 4 },
      { row: 0, column: 5 },
    ]);
  });
});

describe("listShuttleParkingCarExitSides", () => {
  const lot: ShuttleParkingLot = {
    size: 6,
    openSides: ["top", "right"],
    cars: [verticalCar, horizontalCar],
  };

  test.each([
    ["縦の車", verticalCar, ["top"]],
    ["横の車", horizontalCar, ["right"]],
  ] as const)(
    "%sは向きに沿った開いた辺だけから出られること",
    (_, car, expected) => {
      const sides = listShuttleParkingCarExitSides(lot, car);

      expect(sides).toEqual(expected);
    },
  );
});

describe("assertShuttleParkingLot", () => {
  test.each([
    [
      "車が重なる",
      {
        size: 6,
        openSides: ["top"],
        cars: [verticalCar, { ...verticalCar, row: 3 }],
      },
    ],
    [
      "車が駐車場からはみ出す",
      { size: 4, openSides: ["top"], cars: [{ ...verticalCar, row: 2 }] },
    ],
    [
      "開いた辺へ向かない車がある",
      { size: 6, openSides: ["top"], cars: [horizontalCar] },
    ],
    ["開いた辺が無い", { size: 6, openSides: [], cars: [verticalCar] }],
  ] as const satisfies readonly (readonly [string, ShuttleParkingLot])[])(
    "%s駐車場を受け付けないこと",
    (_, lot) => {
      function assertLot() {
        assertShuttleParkingLot(lot);
      }

      expect(assertLot).toThrow(RangeError);
    },
  );
});

import {
  listParkingJamFixedAreaCells,
  type ParkingJamBoard,
  validateParkingJamBoard,
} from "./board";

describe("listParkingJamFixedAreaCells", () => {
  const area = { row: 1, column: 2, width: 2, height: 2 } as const;

  test("固定領域が占有する全セルを列挙すること", () => {
    const cells = listParkingJamFixedAreaCells(area);

    expect(cells).toEqual([
      { row: 1, column: 2 },
      { row: 1, column: 3 },
      { row: 2, column: 2 },
      { row: 2, column: 3 },
    ]);
  });
});

describe("validateParkingJamBoard", () => {
  describe("連続した道路開口と固定領域を持つ盤面の場合", () => {
    const board: ParkingJamBoard = {
      width: 6,
      height: 6,
      vehicles: [
        { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [{ row: 3, column: 2, width: 2, height: 1 }],
      roadOpenings: [
        { side: "right", startOffset: 1, length: 2 },
        { side: "down", startOffset: 4, length: 1 },
      ],
    };

    test("妥当な盤面として受理すること", () => {
      const validate = () => validateParkingJamBoard(board);

      expect(validate).not.toThrow();
    });
  });

  describe("同じ辺の道路開口が接している場合", () => {
    const board: ParkingJamBoard = {
      width: 6,
      height: 6,
      vehicles: [],
      fixedAreas: [],
      roadOpenings: [
        { side: "right", startOffset: 0, length: 2 },
        { side: "right", startOffset: 2, length: 2 },
      ],
    };

    test("一つの開口へ正規化されていない盤面として拒否すること", () => {
      const validate = () => validateParkingJamBoard(board);

      expect(validate).toThrow("road openings overlap or touch");
    });
  });

  describe("固定領域と車が重なる場合", () => {
    const board: ParkingJamBoard = {
      width: 5,
      height: 5,
      vehicles: [
        { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [{ row: 1, column: 2, width: 1, height: 2 }],
      roadOpenings: [{ side: "right", startOffset: 1, length: 1 }],
    };

    test("占有領域の重複として拒否すること", () => {
      const validate = () => validateParkingJamBoard(board);

      expect(validate).toThrow("fixed area overlaps");
    });
  });
});

describe("車のセル座標が整数でない場合", () => {
  const board = {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 1.5, column: 1, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [{ side: "right", startOffset: 1, length: 1 }],
  } as unknown as ParkingJamBoard;

  test("格子盤面として拒否すること", () => {
    const validate = () => validateParkingJamBoard(board);

    expect(validate).toThrow("integer cell coordinates");
  });
});

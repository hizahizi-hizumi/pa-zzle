import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";

import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

const opening = { side: "up", startOffset: 1, length: 2 } as const;

const board: ParkingJamBoard = {
  width: 5,
  height: 4,
  vehicles: [],
  fixedAreas: [],
  roadOpenings: [opening, { side: "right", startOffset: 1, length: 1 }],
};

describe("getBoundaryCurbLines", () => {
  test("道路開口を除いた区間だけに縁石を配置すること", () => {
    const lines = parkingJamBoardGeometry.getBoundaryCurbLines(board);

    expect(lines).toContainEqual({ x1: 0, y1: 0, x2: 100, y2: 0 });
    expect(lines).toContainEqual({ x1: 300, y1: 0, x2: 500, y2: 0 });
    expect(lines).not.toContainEqual({ x1: 100, y1: 0, x2: 300, y2: 0 });
  });
});

describe("getAccessRoadGeometry", () => {
  test("開口から盤外まで舗装面を連続させること", () => {
    const geometry = parkingJamBoardGeometry.getAccessRoadGeometry(
      opening,
      board,
    );

    expect(geometry.x).toBe(PARKING_JAM_CELL);
    expect(geometry.y).toBe(-PARKING_JAM_MARGIN);
    expect(geometry.width).toBe(PARKING_JAM_CELL * 2);
    expect(geometry.height).toBeGreaterThan(PARKING_JAM_MARGIN);
  });
});

describe("getAccessRoadCenterLine", () => {
  test("道路の中央標示を盤外だけに配置すること", () => {
    const line = parkingJamBoardGeometry.getAccessRoadCenterLine(
      opening,
      board,
    );

    expect(line.x1).toBe(PARKING_JAM_CELL * 2);
    expect(line.x2).toBe(PARKING_JAM_CELL * 2);
    expect(line.y1).toBeGreaterThan(-PARKING_JAM_MARGIN);
    expect(line.y2).toBeLessThan(0);
  });
});

describe("getParkingBayLines", () => {
  test("駐車列だけを区切り道路開口には線を置かないこと", () => {
    const lines = parkingJamBoardGeometry.getParkingBayLines(board);
    const upperLines = lines.filter(
      (line) => line.x1 === line.x2 && line.y1 < PARKING_JAM_CELL * 2,
    );

    expect(upperLines.some((line) => line.x1 === 100)).toBe(false);
    expect(upperLines.some((line) => line.x1 === 200)).toBe(false);
    expect(upperLines.some((line) => line.x1 === 300)).toBe(false);
    expect(upperLines.some((line) => line.x1 === 400)).toBe(true);
    expect(upperLines.every((line) => line.y1 !== line.y2)).toBe(true);
  });
});

describe("getVehicleExitTranslation", () => {
  const vehicle = {
    id: "exit-car",
    row: 2,
    column: 1,
    orientation: "horizontal",
    length: 2,
  } as const;

  test("現在位置から盤外へ抜ける距離を返すこと", () => {
    const translation = parkingJamBoardGeometry.getVehicleExitTranslation(
      board,
      vehicle,
      "left",
    );

    expect(translation.x).toBeLessThan(-(vehicle.column * PARKING_JAM_CELL));
    expect(translation.y).toBe(0);
  });
});

describe("getVehicleCollisionTranslation", () => {
  const cases = [
    [
      "隣の車には、間の余白を詰めて少しめり込むまで進む",
      "right",
      {
        target: { kind: "vehicle", vehicleId: "b" },
        freeCellCount: 0,
      },
      { x: 26, y: 0 },
    ],
    [
      "2マス先の植え込みには、空いたマスと余白の分だけ進む",
      "up",
      {
        target: { kind: "fixed-area", cell: { row: 0, column: 0 } },
        freeCellCount: 2,
      },
      { x: 0, y: -226 },
    ],
    [
      "外周には、縁石に当たるまで進む",
      "left",
      { target: { kind: "wall" }, freeCellCount: 1 },
      { x: -109, y: 0 },
    ],
  ] as const;

  test.each(cases)("%sこと", (_, direction, collision, expected) => {
    const translation = parkingJamBoardGeometry.getVehicleCollisionTranslation(
      direction,
      collision,
    );

    expect(translation).toEqual(expected);
  });
});

describe("getLaneCurbLine", () => {
  const vehicle = {
    id: "lane-car",
    row: 2,
    column: 1,
    orientation: "horizontal",
    length: 2,
  } as const;

  test("車の車線が突き当たる外周の1マス分の縁石を返すこと", () => {
    const line = parkingJamBoardGeometry.getLaneCurbLine(
      board,
      vehicle,
      "right",
    );

    expect(line).toEqual({ x1: 500, y1: 200, x2: 500, y2: 300 });
  });
});

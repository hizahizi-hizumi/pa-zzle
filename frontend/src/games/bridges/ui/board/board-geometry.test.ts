import {
  findBridgesEdgeToward,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  findBoardTarget,
  findDragDirection,
  getBridgeLineOffsets,
  getEdgeSegment,
  getIslandCenter,
  hasLeftIsland,
} from "@/games/bridges/ui/board/board-geometry";

// 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。
// 辺: 0 = 島0-島1（横 y=0.5）、1 = 島0-島2（縦 x=0.5）、2 = 島1-島4（縦 x=2.5）、3 = 島2-島3（横 y=2.5）。
// 辺2と辺3が (2.5, 2.5) で交わる。
const board = parseBridgesBoard(["1.1..", ".....", "1...1", ".....", "..1.."]);
const noBridges: readonly BridgeCount[] = [0, 0, 0, 0];

describe("getIslandCenter", () => {
  test("島のマスの中心を返すこと", () => {
    const center = getIslandCenter(board.islands[4]!);

    expect(center).toEqual({ x: 2.5, y: 4.5 });
  });
});

describe("getEdgeSegment", () => {
  test("両端の島の丸の縁から縁までの線分を返すこと", () => {
    const segment = getEdgeSegment(board, 2);

    expect(segment).toEqual({
      start: { x: 2.5, y: 0.9 },
      end: { x: 2.5, y: 4.1 },
    });
  });
});

describe("getBridgeLineOffsets", () => {
  test.each([
    [0, []],
    [1, [0]],
    [2, [-0.1, 0.1]],
  ] as const)("%s本の橋の線のずれが %j であること", (count, expected) => {
    const offsets = getBridgeLineOffsets(count);

    expect(offsets).toEqual(expected);
  });
});

describe("findBoardTarget", () => {
  test.each([
    ["島の丸の中", { x: 0.7, y: 0.6 }, { kind: "island", island: 0 }],
    ["横の線の近く", { x: 1.5, y: 0.9 }, { kind: "edge", edge: 0 }],
    ["縦の線の近く", { x: 0.1, y: 1.5 }, { kind: "edge", edge: 1 }],
    ["どの線からも半マスより遠い所", { x: 1.5, y: 1.5 }, null],
    ["両端の島の外側", { x: 3.5, y: 0.5 }, null],
    [
      "交点の近くで縦の線に近い所",
      { x: 2.6, y: 2.2 },
      { kind: "edge", edge: 2 },
    ],
    [
      "交点の近くで横の線に近い所",
      { x: 2.2, y: 2.6 },
      { kind: "edge", edge: 3 },
    ],
    ["2本の線からちょうど同じ距離の所", { x: 3.0, y: 2.0 }, null],
  ] as const)("%sを押すと %j を指すこと", (_, point, expected) => {
    const target = findBoardTarget(board, noBridges, point);

    expect(target).toEqual(expected);
  });

  describe("交わる辺の横の方に橋がある場合", () => {
    const horizontalBridged: readonly BridgeCount[] = [0, 0, 0, 1];

    test("縦の線に近い所を押しても橋のある横の辺を指すこと", () => {
      const target = findBoardTarget(board, horizontalBridged, {
        x: 2.6,
        y: 2.2,
      });

      expect(target).toEqual({ kind: "edge", edge: 3 });
    });
  });

  describe("交わる辺の縦の方に橋がある場合", () => {
    const verticalBridged: readonly BridgeCount[] = [0, 0, 2, 0];

    test.each([
      ["横の線に近い所", { x: 2.2, y: 2.6 }],
      ["2本の線からちょうど同じ距離の所", { x: 3.0, y: 2.0 }],
    ] as const)("%sを押しても橋のある縦の辺を指すこと", (_, point) => {
      const target = findBoardTarget(board, verticalBridged, point);

      expect(target).toEqual({ kind: "edge", edge: 2 });
    });
  });

  describe("短い辺の真ん中が長い辺の上に乗る盤面の場合", () => {
    // 縦の E–J（(1,4)-(3,4)、間が1マス）の真ん中 (4.5, 2.5) を、横の G–H（(2,2)-(2,6)、間が3マス）が通る。
    const crossingBoard = parseBridgesBoard([
      "2..2..2",
      ".2..3..",
      "3.1...2",
      ".2..3..",
      ".......",
      ".2.1...",
      "3...4.2",
    ]);
    function islandAt(row: number, column: number): number {
      return crossingBoard.islands.findIndex(
        (island) => island.row === row && island.column === column,
      );
    }
    const shortEdge = findBridgesEdgeToward(
      crossingBoard,
      islandAt(1, 4),
      "down",
    );
    const longEdge = findBridgesEdgeToward(
      crossingBoard,
      islandAt(2, 2),
      "right",
    );
    const empty = getBridgesNetwork(crossingBoard).edges.map(
      (): BridgeCount => 0,
    );

    test.each([
      ["短い辺の真ん中", "短い", { x: 4.5, y: 2.5 }],
      // 試遊で縦の E–J を狙って押した位置（390px 幅の画面の (245, 274)）。
      ["試遊で短い辺を狙って押した所", "短い", { x: 4.478, y: 2.483 }],
      ["交点から横の線に沿って離れた所", "長い", { x: 4.8, y: 2.5 }],
      ["交点から縦の線に沿って離れた所", "短い", { x: 4.5, y: 2.8 }],
    ] as const)("%sを押すと%s辺を指すこと", (_, expected, point) => {
      const target = findBoardTarget(crossingBoard, empty, point);

      expect(target).toEqual({
        kind: "edge",
        edge: expected === "短い" ? shortEdge : longEdge,
      });
    });
  });

  describe("交わらない辺に橋がある場合", () => {
    const bridges: readonly BridgeCount[] = [0, 1, 0, 0];

    test("橋の有無によらず最も近い線の辺を指すこと", () => {
      const target = findBoardTarget(board, bridges, { x: 0.95, y: 0.55 });

      expect(target).toEqual({ kind: "edge", edge: 0 });
    });
  });
});

describe("hasLeftIsland", () => {
  test.each([
    [{ x: 0.8, y: 0.5 }, false],
    [{ x: 0.95, y: 0.5 }, true],
  ] as const)("島0 から %j まで動いたら %s を返すこと", (point, expected) => {
    const left = hasLeftIsland(board, 0, point);

    expect(left).toBe(expected);
  });
});

describe("findDragDirection", () => {
  test.each([
    [{ x: 1.4, y: 0.8 }, "right"],
    [{ x: 0.8, y: 1.4 }, "down"],
    [{ x: -0.4, y: 0.6 }, "left"],
    [{ x: 0.6, y: -0.4 }, "up"],
  ] as const)(
    "島0 から %j へなぞった向きが %s であること",
    (point, expected) => {
      const direction = findDragDirection(board, 0, point);

      expect(direction).toBe(expected);
    },
  );
});

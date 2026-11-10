import {
  findBridgesEdgeToward,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  BOARD_MARGIN,
  createBoardView,
  findBoardTarget,
  findDragEdge,
  findEdgeBetween,
  findIslandToward,
  getBridgeLineOffsets,
  getEdgeViewSegment,
  getIslandCenter,
  toBoardPoint,
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

describe("getEdgeViewSegment", () => {
  const view = createBoardView(board);

  test("両端の島の中心を、周りの海の余白だけずらして結ぶこと", () => {
    const segment = getEdgeViewSegment(view, 2);

    expect(segment).toEqual({
      start: { x: 2.5 + BOARD_MARGIN, y: 0.5 + BOARD_MARGIN },
      end: { x: 2.5 + BOARD_MARGIN, y: 4.5 + BOARD_MARGIN },
    });
  });
});

describe("toBoardPoint", () => {
  const view = createBoardView(board);
  const frame = {
    left: 10,
    top: 20,
    width: view.width * 100,
    height: view.height * 100,
  };

  test("絵の上の点を、周りの海の余白を除いた盤面の座標へ戻すこと", () => {
    const point = toBoardPoint(
      view,
      frame,
      10 + (2.5 + BOARD_MARGIN) * 100,
      20 + (4.5 + BOARD_MARGIN) * 100,
    );

    expect(point.x).toBeCloseTo(2.5);
    expect(point.y).toBeCloseTo(4.5);
  });
});

describe("getBridgeLineOffsets", () => {
  test.each([
    [0, []],
    [1, [0]],
    [2, [-0.15, 0.15]],
  ] as const)("%s本の橋の線のずれが %j であること", (count, expected) => {
    const offsets = getBridgeLineOffsets(count);

    expect(offsets).toEqual(expected);
  });
});

describe("findBoardTarget", () => {
  test.each([
    ["島の陸の中", { x: 0.7, y: 0.6 }, { kind: "island", island: 0 }],
    [
      "島の陸の外でも、中心から半マスの内",
      { x: 0.95, y: 0.6 },
      { kind: "island", island: 0 },
    ],
    [
      "島の周りの波打ち際の泡の上で、横の線の上",
      { x: 1.04, y: 0.5 },
      { kind: "island", island: 0 },
    ],
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
  ] as const)("%sを押すと %j を指すこと", (_, point, expected) => {
    const target = findBoardTarget(board, noBridges, point);

    expect(target).toEqual(expected);
  });

  describe("交わる2本の線から同じ距離で、真ん中からのずれも同じ所を押した場合", () => {
    const point = { x: 3.0, y: 2.0 };

    test("直前に触った島が無ければ、番号の小さい辺に決めること", () => {
      const target = findBoardTarget(board, noBridges, point);

      expect(target).toEqual({ kind: "edge", edge: 2 });
    });

    test.each([
      ["横の辺の端の島2", [2], 3],
      ["縦の辺の端の島4", [4], 2],
    ] as const)(
      "直前に%sを触っていれば、その島から伸びる辺 %s に決めること",
      (_, recentIslands, expected) => {
        const target = findBoardTarget(board, noBridges, point, recentIslands);

        expect(target).toEqual({ kind: "edge", edge: expected });
      },
    );
  });

  describe("交わる辺の横の方に橋がある場合", () => {
    const horizontalBridged: readonly BridgeCount[] = [0, 0, 0, 1];

    test.each([
      ["縦の線にはっきり近い所", { x: 2.6, y: 2.2 }, 2],
      ["横の線にはっきり近い所", { x: 2.2, y: 2.6 }, 3],
      ["交点のすぐそばで、2本の線から見分けにくい所", { x: 2.4, y: 2.45 }, 2],
    ] as const)("%sを押すと辺 %s を指すこと", (_, point, expected) => {
      const target = findBoardTarget(board, horizontalBridged, point, [2, 3]);

      expect(target).toEqual({ kind: "edge", edge: expected });
    });
  });

  describe("交わる辺の縦の方に橋がある場合", () => {
    const verticalBridged: readonly BridgeCount[] = [0, 0, 2, 0];

    test.each([
      ["横の線にはっきり近い所", { x: 2.2, y: 2.6 }, 3],
      ["2本の線からちょうど同じ距離の所", { x: 3.0, y: 2.0 }, 3],
    ] as const)(
      "%sを押すと、橋を増やさず橋の無い辺 %s を指すこと",
      (_, point, expected) => {
        const target = findBoardTarget(board, verticalBridged, point, [1, 4]);

        expect(target).toEqual({ kind: "edge", edge: expected });
      },
    );
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
      [
        "短い辺の真ん中から指のぶれほど斜めにずれた所",
        "短い",
        { x: 4.45, y: 2.45 },
      ],
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

  describe("交わらない平行な2線から同じ距離の所を押した場合", () => {
    // 辺0 = 島0 (0,0)-島1 (0,3)（横 y=0.5）、辺1 = 島2 (1,1)-島3 (1,4)（横 y=1.5）。
    const parallelBoard = parseBridgesBoard([
      "1..1.",
      ".1..1",
      ".....",
      ".....",
    ]);
    const bridges: readonly BridgeCount[] = getBridgesNetwork(
      parallelBoard,
    ).edges.map((_, edge) => (edge === 0 ? 1 : 0));
    const point = { x: 2.5, y: 1 };

    test("橋の有無では選ばず、直前に触った島から伸びる辺に決めること", () => {
      const target = findBoardTarget(parallelBoard, bridges, point, [3]);

      expect(target).toEqual({ kind: "edge", edge: 1 });
    });
  });
});

describe("findEdgeBetween", () => {
  test.each([
    [0, 1, 0],
    [1, 0, 0],
    [0, 4, null],
  ] as const)(
    "島 %s と島 %s の間の辺が %s であること",
    (island, other, expected) => {
      const edge = findEdgeBetween(board, island, other);

      expect(edge).toBe(expected);
    },
  );
});

describe("findDragEdge", () => {
  test.each([
    ["島の的の中", 0, { x: 0.9, y: 0.6 }, null],
    ["右へなぞり、相手の島に届く前", 0, { x: 1.3, y: 0.6 }, 0],
    ["下へなぞり、相手の島に届く前", 0, { x: 0.6, y: 1.3 }, 1],
    ["右の相手の島の陸の中", 0, { x: 2.3, y: 0.6 }, 0],
    ["右の相手の島を通り過ぎた所", 0, { x: 4.6, y: 0.9 }, 0],
    ["右下へ斜めに、横に大きく動いた所", 0, { x: 2.2, y: 1.4 }, 0],
    ["右下へ斜めに、縦に大きく動いた所", 0, { x: 1.4, y: 2.2 }, 1],
    ["辺の無い向き", 1, { x: 3.6, y: 0.5 }, null],
  ] as const)(
    "%s（島 %s から %j）で離すと辺 %s を回すこと",
    (_, island, point, expected) => {
      const edge = findDragEdge(board, island, point);

      expect(edge).toBe(expected);
    },
  );
});

describe("findIslandToward", () => {
  test.each([
    [0, "right", 1],
    [0, "down", 2],
    [0, "up", null],
    [3, "up", 1],
    [4, "left", 2],
  ] as const)(
    "島 %s から %s へ移ると島 %s に着くこと",
    (island, direction, expected) => {
      const next = findIslandToward(board, island, direction);

      expect(next).toBe(expected);
    },
  );
});

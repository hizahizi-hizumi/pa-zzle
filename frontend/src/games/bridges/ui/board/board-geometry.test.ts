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
  findDragAim,
  findEdgeBetween,
  findIslandToward,
  getBridgeLineOffsets,
  getEdgeViewSegment,
  getIslandCenter,
  toBoardPoint,
  WIDE_BOARD_MARGIN,
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

describe("createBoardView", () => {
  test("9×9 より小さい盤面には、周りに広い海の余白を置くこと", () => {
    const view = createBoardView(board);

    expect(view).toMatchObject({
      margin: BOARD_MARGIN,
      width: 5 + 2 * BOARD_MARGIN,
    });
  });

  test("9×9 以上の盤面では、海の余白を詰めて島を大きく描くこと", () => {
    const wide = parseBridgesBoard(
      Array.from({ length: 9 }, (_, row) =>
        row % 2 === 0 ? "1.......1" : ".........",
      ),
    );

    expect(createBoardView(wide)).toMatchObject({
      margin: WIDE_BOARD_MARGIN,
      width: 9 + 2 * WIDE_BOARD_MARGIN,
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
    ["横の線の近く", { x: 1.5, y: 0.75 }, { kind: "edge", edge: 0 }],
    ["縦の線の近く", { x: 0.25, y: 1.5 }, { kind: "edge", edge: 1 }],
    ["横の線から 0.4 マス離れた海", { x: 1.5, y: 0.9 }, null],
    ["どの線からも半マス離れた海", { x: 1.5, y: 1.5 }, null],
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
    const point = { x: 2.7, y: 2.3 };

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
      ["交点のすぐそばで、2本の線から見分けにくい所", { x: 2.4, y: 2.45 }, 3],
    ] as const)("%s（%j）を押すと辺 %s を指すこと", (_, point, expected) => {
      const target = findBoardTarget(board, horizontalBridged, point, [2, 3]);

      expect(target).toEqual({ kind: "edge", edge: expected });
    });
  });

  describe("交わる辺の縦の方に橋がある場合", () => {
    const verticalBridged: readonly BridgeCount[] = [0, 0, 2, 0];

    test.each([
      ["横の線にはっきり近く、縦の橋の板の外", { x: 2.2, y: 2.6 }, 3],
      ["2本の線からちょうど同じ距離で、縦の橋の板の上", { x: 2.7, y: 2.3 }, 2],
      ["交点", { x: 2.5, y: 2.5 }, 2],
    ] as const)(
      "%s（%j）を押すと辺 %s を指すこと",
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

  describe("短い橋の真ん中を、交わる別の組の通り道が通る盤面の場合", () => {
    // 7×7 の盤面。横の 3–1（(4,0)-(4,2)）の真ん中 (1.5, 4.5) を、縦の 4–1（(3,1)-(5,1)）の真ん中が通る。
    const shortBridgeBoard = parseBridgesBoard([
      "2....1.",
      ".2.5..4",
      ".......",
      ".4.7.3.",
      "3.1....",
      ".1.2..2",
      "3.3..3.",
    ]);
    function islandAt(row: number, column: number): number {
      return shortBridgeBoard.islands.findIndex(
        (island) => island.row === row && island.column === column,
      );
    }
    const horizontal = findBridgesEdgeToward(
      shortBridgeBoard,
      islandAt(4, 0),
      "right",
    )!;
    const vertical = findBridgesEdgeToward(
      shortBridgeBoard,
      islandAt(3, 1),
      "down",
    )!;
    function withBridges(
      counts: Readonly<Record<number, BridgeCount>>,
    ): readonly BridgeCount[] {
      return getBridgesNetwork(shortBridgeBoard).edges.map(
        (_, edge) => counts[edge] ?? 0,
      );
    }

    test.each([
      ["横", horizontal],
      ["縦", vertical],
    ] as const)(
      "%sの組に橋が1本あれば、真ん中を押すとその橋の辺を指すこと",
      (_, bridged) => {
        const target = findBoardTarget(
          shortBridgeBoard,
          withBridges({ [bridged]: 1 }),
          { x: 1.5, y: 4.5 },
        );

        expect(target).toEqual({ kind: "edge", edge: bridged });
      },
    );

    test("横の組の2本の橋の板の上を押すと、縦の線がもっと近くても横の辺を指すこと", () => {
      const target = findBoardTarget(
        shortBridgeBoard,
        withBridges({ [horizontal]: 2 }),
        { x: 1.55, y: 4.7 },
      );

      expect(target).toEqual({ kind: "edge", edge: horizontal });
    });
  });

  describe("長い通り道が2つの短い組の真ん中を通る盤面の場合", () => {
    // 9×9 の盤面。横の 1–1（(4,1)-(4,6)）が、縦の 4–7（(3,3)-(5,3)）と 4–5（(3,5)-(5,5)）の真ん中を通る。
    const longPathBoard = parseBridgesBoard([
      "4......2.",
      ".2.2..3.2",
      "3........",
      "...4.4...",
      ".1....1..",
      "4..7.5..3",
      ".........",
      ".1.3.....",
      "1....2..2",
    ]);
    function islandAt(row: number, column: number): number {
      return longPathBoard.islands.findIndex(
        (island) => island.row === row && island.column === column,
      );
    }
    const longPath = findBridgesEdgeToward(
      longPathBoard,
      islandAt(4, 1),
      "right",
    )!;
    const leftPair = findBridgesEdgeToward(
      longPathBoard,
      islandAt(3, 3),
      "down",
    )!;
    const rightPair = findBridgesEdgeToward(
      longPathBoard,
      islandAt(3, 5),
      "down",
    )!;
    function withBridges(
      counts: Readonly<Record<number, BridgeCount>>,
    ): readonly BridgeCount[] {
      return getBridgesNetwork(longPathBoard).edges.map(
        (_, edge) => counts[edge] ?? 0,
      );
    }

    test.each([
      ["左の 4–7", { x: 3.5, y: 4.5 }, leftPair],
      ["右の 4–5", { x: 5.5, y: 4.5 }, rightPair],
    ] as const)(
      "%sの組の橋の真ん中を押すと、その橋の辺を指すこと",
      (_, point, expected) => {
        const target = findBoardTarget(
          longPathBoard,
          withBridges({ [leftPair]: 1, [rightPair]: 1 }),
          point,
        );

        expect(target).toEqual({ kind: "edge", edge: expected });
      },
    );

    test("どちらにも橋の無い交点の近くでは、別の橋に阻まれる長い通り道より、阻まれない短い組を指すこと", () => {
      const target = findBoardTarget(
        longPathBoard,
        withBridges({ [rightPair]: 1 }),
        { x: 3.75, y: 4.62 },
      );

      expect(target).toEqual({ kind: "edge", edge: leftPair });
    });

    test("どこにも橋の無い盤面の同じ所では、横の線に近く真ん中にも近い長い通り道を指すこと", () => {
      const target = findBoardTarget(longPathBoard, withBridges({}), {
        x: 3.75,
        y: 4.62,
      });

      expect(target).toEqual({ kind: "edge", edge: longPath });
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

describe("findDragAim", () => {
  test.each([
    ["島の的の中", 0, { x: 0.9, y: 0.6 }, null],
    [
      "右へなぞり、相手の島に届く前",
      0,
      { x: 1.3, y: 0.6 },
      { edge: 0, landed: false },
    ],
    [
      "下へなぞり、相手の島に届く前",
      0,
      { x: 0.6, y: 1.3 },
      { edge: 1, landed: false },
    ],
    ["右の相手の島の陸の中", 0, { x: 2.3, y: 0.6 }, { edge: 0, landed: true }],
    [
      "右の相手の島を通り過ぎた所",
      0,
      { x: 4.6, y: 0.9 },
      { edge: 0, landed: true },
    ],
    [
      "右へ 20° ほど傾けて相手の島の近くまで",
      0,
      { x: 1.9, y: 1.0 },
      { edge: 0, landed: true },
    ],
    ["右下へ斜めに 28° ほど", 0, { x: 2.2, y: 1.4 }, null],
    ["右下へ斜めに 45°", 0, { x: 1.4, y: 1.4 }, null],
    ["辺の無い向き", 1, { x: 3.6, y: 0.5 }, null],
  ] as const)(
    "%s（島 %s から %j）では、狙いが %j であること",
    (_, island, point, expected) => {
      const aim = findDragAim(board, island, point);

      expect(aim).toEqual(expected);
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

import {
  findBridgesEdgeToward,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  findBoardTarget,
  findDragEdge,
  findIslandToward,
  getBridgeLineOffsets,
  getEdgeSegment,
  getIslandCenter,
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
    [
      "2本の線からちょうど同じ距離の所",
      { x: 3.0, y: 2.0 },
      { kind: "ambiguous", edges: [2, 3] },
    ],
  ] as const)("%sを押すと %j を指すこと", (_, point, expected) => {
    const target = findBoardTarget(board, noBridges, point);

    expect(target).toEqual(expected);
  });

  describe("交わる辺の横の方に橋がある場合", () => {
    const horizontalBridged: readonly BridgeCount[] = [0, 0, 0, 1];

    test.each([
      ["縦の線にはっきり近い所", { x: 2.6, y: 2.2 }, 2],
      ["交点のすぐそばで、2本の線から見分けにくい所", { x: 2.55, y: 2.4 }, 3],
    ] as const)("%sを押すと辺 %s を指すこと", (_, point, expected) => {
      const target = findBoardTarget(board, horizontalBridged, point);

      expect(target).toEqual({ kind: "edge", edge: expected });
    });
  });

  describe("交わる辺の縦の方に橋がある場合", () => {
    const verticalBridged: readonly BridgeCount[] = [0, 0, 2, 0];

    test.each([
      ["横の線にはっきり近い所", { x: 2.2, y: 2.6 }, 3],
      ["2本の線からちょうど同じ距離の所", { x: 3.0, y: 2.0 }, 2],
    ] as const)("%sを押すと辺 %s を指すこと", (_, point, expected) => {
      const target = findBoardTarget(board, verticalBridged, point);

      expect(target).toEqual({ kind: "edge", edge: expected });
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

  describe("交わらない辺に橋がある場合", () => {
    const bridges: readonly BridgeCount[] = [0, 1, 0, 0];

    test("橋の有無によらず最も近い線の辺を指すこと", () => {
      const target = findBoardTarget(board, bridges, { x: 0.95, y: 0.55 });

      expect(target).toEqual({ kind: "edge", edge: 0 });
    });
  });

  describe("交わらない平行な2線の片方に橋があり、両方の線から同じ距離の所を押した場合", () => {
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

    test("橋のある方を選ばず、2つの辺を候補として返すこと", () => {
      const target = findBoardTarget(parallelBoard, bridges, {
        x: 2.5,
        y: 1,
      });

      expect(target).toEqual({ kind: "ambiguous", edges: [0, 1] });
    });
  });
});

describe("findDragEdge", () => {
  test.each([
    ["島の丸の中", 0, { x: 0.8, y: 0.5 }, null],
    ["右へなぞった先", 0, { x: 1.4, y: 0.8 }, 0],
    ["下へなぞった先", 0, { x: 0.8, y: 1.4 }, 1],
    ["右下へ縦横同じだけなぞった先", 0, { x: 1.3, y: 1.3 }, null],
    ["隣の島の丸の中", 0, { x: 2.3, y: 0.6 }, 0],
    ["辺の無い島の丸の中", 0, { x: 2.5, y: 4.5 }, null],
    ["辺の無い向きへなぞった先", 0, { x: -0.5, y: 0.5 }, null],
    [
      "左上へ斜めになぞった先（近い向きのうち辺は左だけ）",
      3,
      { x: 3.8, y: 1.8 },
      3,
    ],
    [
      "左下へ斜めになぞった先（近い向きの両方に辺がある）",
      1,
      { x: 1.8, y: 1.2 },
      null,
    ],
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

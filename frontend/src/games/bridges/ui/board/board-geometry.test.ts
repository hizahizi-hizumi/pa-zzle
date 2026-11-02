import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
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

  describe("交わる辺の片方に橋がある場合", () => {
    const horizontalBridged: readonly BridgeCount[] = [0, 0, 0, 1];
    const verticalBridged: readonly BridgeCount[] = [0, 0, 2, 0];

    test.each([
      ["横の橋がある", horizontalBridged, { x: 2.6, y: 2.2 }, 3],
      ["縦の橋がある", verticalBridged, { x: 2.2, y: 2.6 }, 2],
      ["縦の橋がある", verticalBridged, { x: 3.0, y: 2.0 }, 2],
    ] as const)(
      "%sとき、橋の無い線に近い所を押しても橋のある辺 %s を指すこと",
      (_, bridges, point, expected) => {
        const target = findBoardTarget(board, bridges, point);

        expect(target).toEqual({ kind: "edge", edge: expected });
      },
    );
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

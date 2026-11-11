import {
  decodeBridgesPoolProblem,
  listBridgesPoolEntries,
} from "@/games/bridges/problem/problem-pool";
import {
  type BridgesBoard,
  findBridgesEdgeToward,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  BOARD_MARGIN,
  type BoardPoint,
  createBoardView,
  findBoardTarget,
  findDragAim,
  findEdgeBetween,
  findIslandToward,
  getBridgeLineOffsets,
  getEdgeViewSegment,
  getIslandCenter,
  ISLAND_RADIUS,
  toBoardPoint,
  WIDE_BOARD_MARGIN,
} from "@/games/bridges/ui/board/board-geometry";
import { difficultyLevels } from "@/games/difficulty";

// 島: 0 (0,0)、1 (0,2)、2 (2,0)、3 (2,4)、4 (4,2)。
// 辺: 0 = 島0-島1（横 y=0.5）、1 = 島0-島2（縦 x=0.5）、2 = 島1-島4（縦 x=2.5）、3 = 島2-島3（横 y=2.5）。
// 辺2と辺3が (2.5, 2.5) で交わる。
const board = parseBridgesBoard(["1.1..", ".....", "1...1", ".....", "..1.."]);

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

  test("2枚の板の間隔を渡すと、その間隔で中心線を挟むこと", () => {
    const offsets = getBridgeLineOffsets(2, 0.34);

    expect(offsets).toEqual([-0.17, 0.17]);
  });
});

describe("findBoardTarget", () => {
  test.each([
    ["島の陸の中", { x: 0.7, y: 0.6 }, { kind: "island", island: 0 }],
    ["島の陸の縁", { x: 0.9, y: 0.65 }, { kind: "island", island: 0 }],
    [
      "島の陸のすぐ外の、横の線の上",
      { x: 1.08, y: 0.5 },
      { kind: "edge", edge: 0 },
    ],
    [
      "島から出る横と縦の線のどちらからも同じだけ離れた、島のマスの角",
      { x: 0.98, y: 0.98 },
      { kind: "ambiguous", edges: [0, 1] },
    ],
    ["横の線の近く", { x: 1.5, y: 0.75 }, { kind: "edge", edge: 0 }],
    ["縦の線の近く", { x: 0.25, y: 1.5 }, { kind: "edge", edge: 1 }],
    [
      "横の線から 0.4 マス離れた海",
      { x: 1.5, y: 0.9 },
      { kind: "edge", edge: 0 },
    ],
    ["どの線からも 1 マス離れた海", { x: 1.5, y: 1.5 }, null],
    ["両端の島の外側", { x: 3.5, y: 0.5 }, null],
    [
      "交点から縦の線に沿って離れた所",
      { x: 2.6, y: 1.9 },
      { kind: "edge", edge: 2 },
    ],
    [
      "交点から横の線に沿って離れた所",
      { x: 1.6, y: 2.6 },
      { kind: "edge", edge: 3 },
    ],
    ["交点", { x: 2.5, y: 2.5 }, { kind: "ambiguous", edges: [2, 3] }],
    [
      "交点の近くで、2本の線から同じだけ離れた所",
      { x: 2.75, y: 2.25 },
      { kind: "ambiguous", edges: [2, 3] },
    ],
  ] as const)("%sを押すと %j を指すこと", (_, point, expected) => {
    const target = findBoardTarget(board, point);

    expect(target).toEqual(expected);
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

describe("交わる2本の線のどちらからもほとんど同じだけ離れた所を押した場合", () => {
  // 8×8 の盤面。縦の 1–4（(1,1)-(5,1)）と横の 2–2（(3,0)-(3,2)）が、横の2島の真ん中 (1.5, 3.5) で交わる。
  const crossBoard = parseBridgesBoard([
    "3.3....2",
    ".1..1...",
    ".....4.5",
    "2.2.3...",
    ".....2..",
    ".4..4..4",
    "........",
    ".4..3.1.",
  ]);
  function islandAt(row: number, column: number): number {
    return crossBoard.islands.findIndex(
      (island) => island.row === row && island.column === column,
    );
  }
  const vertical = findBridgesEdgeToward(crossBoard, islandAt(1, 1), "down")!;
  const horizontal = findBridgesEdgeToward(
    crossBoard,
    islandAt(3, 0),
    "right",
  )!;
  const bothEdges = [vertical, horizontal].sort((left, right) => left - right);

  test.each([
    ["交点", { x: 1.5, y: 3.5 }],
    ["交点から右へ 0.15 マス", { x: 1.65, y: 3.5 }],
    ["交点から上へ 0.15 マス", { x: 1.5, y: 3.35 }],
  ] as const)(
    "%sを押すと、どちらの辺にも決めず2辺を候補として返すこと",
    (_, point) => {
      const target = findBoardTarget(crossBoard, point);

      expect(target).toEqual({ kind: "ambiguous", edges: bothEdges });
    },
  );

  test.each([
    ["縦の線の上で、横の線から 1 マス離れた所", { x: 1.55, y: 2.5 }, vertical],
    ["縦の線の上で、交点から上へ 0.25 マス", { x: 1.5, y: 3.25 }, vertical],
    [
      "縦の線の上で、横の線から 0.35 マス離れた所",
      { x: 1.5, y: 3.85 },
      vertical,
    ],
  ] as const)("%sを押すと縦の辺を指すこと", (_, point, expected) => {
    const target = findBoardTarget(crossBoard, point);

    expect(target).toEqual({ kind: "edge", edge: expected });
  });
});

describe("問題集の全問の当たり判定", () => {
  /** 島の陸が輪郭の揺らぎで広がる最大の半径に、指のぶれを少し足した距離。これより島の中心から離れた点を水面とする。 */
  const LAND_CLEARANCE = ISLAND_RADIUS * 1.08 + 0.06;
  /** 押した点に別の線が、狙った線よりこれ以上離れていれば、狙った線が明らかに近いとする。 */
  const CLEAR_LEAD = 0.25;
  /** 線の当たり範囲の、線から片側の幅。 */
  const LINE_HALF_WIDTH = 0.5;
  /** 線を横切る向きに取る、線からのずれ。 */
  const ACROSS_OFFSETS = [-0.4, -0.2, 0, 0.2, 0.4];

  const boards: { label: string; board: BridgesBoard }[] =
    difficultyLevels.flatMap(({ id }) =>
      listBridgesPoolEntries(id).map((entry, index) => ({
        label: `Lv${id}-${index}`,
        board: decodeBridgesPoolProblem(entry[0], entry[8], entry[9]),
      })),
    );

  type Line = { horizontal: boolean; at: number; low: number; high: number };

  function listLines(board: BridgesBoard): Line[] {
    return getBridgesNetwork(board).edges.map(({ from, to, orientation }) => {
      const start = getIslandCenter(board.islands[from]!);
      const end = getIslandCenter(board.islands[to]!);
      return orientation === "horizontal"
        ? { horizontal: true, at: start.y, low: start.x, high: end.x }
        : { horizontal: false, at: start.x, low: start.y, high: end.y };
    });
  }

  /** 点が線の当たり範囲（2島の中心の間で、線から片側 `LINE_HALF_WIDTH` まで）にあれば線までの距離、無ければ `null`。 */
  function distanceInLineRange(
    line: Line,
    { x, y }: BoardPoint,
  ): number | null {
    const [along, across] = line.horizontal ? [x, y] : [y, x];
    const distance = Math.abs(across - line.at);
    return line.low < along && along < line.high && distance <= LINE_HALF_WIDTH
      ? distance
      : null;
  }

  /** 線ごとに、両端の島の陸のすぐ外と2島の真ん中で、線を横切る向きにずらした点。 */
  function listSamplePoints(line: Line): BoardPoint[] {
    const alongs = [
      line.low + LAND_CLEARANCE,
      (line.low + line.high) / 2,
      line.high - LAND_CLEARANCE,
    ];
    return alongs.flatMap((along) =>
      ACROSS_OFFSETS.map((offset) =>
        line.horizontal
          ? { x: along, y: line.at + offset }
          : { x: line.at + offset, y: along },
      ),
    );
  }

  test("どの組の線も、陸の外で他の線より明らかに近い点を押すと、その線を指すこと", () => {
    const misses: string[] = [];
    let checked = 0;
    for (const { label, board } of boards) {
      const lines = listLines(board);
      const centers = board.islands.map(getIslandCenter);
      for (const [edge, line] of lines.entries()) {
        for (const point of listSamplePoints(line)) {
          const onLand = centers.some(
            (center) =>
              Math.hypot(point.x - center.x, point.y - center.y) <
              LAND_CLEARANCE,
          );
          const own = distanceInLineRange(line, point);
          if (onLand || own === null) {
            continue;
          }
          const rivalNear = lines.some((other, index) => {
            if (index === edge) return false;
            const distance = distanceInLineRange(other, point);
            return distance !== null && distance < own + CLEAR_LEAD;
          });
          if (rivalNear) {
            continue;
          }
          checked += 1;
          const target = findBoardTarget(board, point);
          if (target?.kind !== "edge" || target.edge !== edge) {
            misses.push(
              `${label} 辺${edge} (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) → ${JSON.stringify(target)}`,
            );
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(1000);
    expect(misses.slice(0, 10)).toEqual([]);
  });

  test("どの島も、陸の中を押すとその島を指すこと", () => {
    const misses: string[] = [];
    for (const { label, board } of boards) {
      for (const [island, center] of board.islands
        .map(getIslandCenter)
        .entries()) {
        for (let step = 0; step < 8; step += 1) {
          const angle = (step / 8) * 2 * Math.PI;
          const point = {
            x: center.x + Math.cos(angle) * ISLAND_RADIUS * 0.9,
            y: center.y + Math.sin(angle) * ISLAND_RADIUS * 0.9,
          };
          const target = findBoardTarget(board, point);
          if (target?.kind !== "island" || target.island !== island) {
            misses.push(`${label} 島${island} → ${JSON.stringify(target)}`);
          }
        }
      }
    }

    expect(misses.slice(0, 10)).toEqual([]);
  });
});

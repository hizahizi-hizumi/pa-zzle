import {
  assertBridgesBoard,
  type BridgesBoard,
  type BridgesIsland,
  findBridgesEdgeToward,
  formatBridgesBoard,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  createProblemSeededRandom,
  type ProblemRandom,
} from "@/games/problem-seed";

function createRandomBoard(random: ProblemRandom): BridgesBoard {
  const width = 3 + Math.floor(random() * 8);
  const height = 3 + Math.floor(random() * 8);
  const occupied = new Set<string>();
  const islands: BridgesIsland[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const touches =
        occupied.has(`${row - 1},${column}`) ||
        occupied.has(`${row},${column - 1}`);
      if (!touches && random() < 0.35) {
        occupied.add(`${row},${column}`);
        islands.push({ row, column, clue: 1 });
      }
    }
  }
  return { width, height, islands };
}

/** 全部の島の組から、同じ行か列で間に島の無い組を「左（上）の島-右（下）の島」で挙げる。 */
function listPairsNaively(board: BridgesBoard): string[] {
  const { islands } = board;
  return islands.flatMap((a, from) =>
    islands.flatMap((b, to) => {
      const sameRow = a.row === b.row && a.column < b.column;
      const sameColumn = a.column === b.column && a.row < b.row;
      const between = islands.some(
        (c) =>
          (sameRow &&
            c.row === a.row &&
            a.column < c.column &&
            c.column < b.column) ||
          (sameColumn &&
            c.column === a.column &&
            a.row < c.row &&
            c.row < b.row),
      );
      return (sameRow || sameColumn) && !between ? [`${from}-${to}`] : [];
    }),
  );
}

/** 2つの辺の間のマス（端の島を除く）が重なる組を、辺の番号の組で挙げる。 */
function listCrossingsNaively(board: BridgesBoard): string[] {
  const { edges } = getBridgesNetwork(board);
  const cellsOf = edges.map(({ from, to }) => {
    const a = board.islands[from]!;
    const b = board.islands[to]!;
    const cells = new Set<string>();
    for (let row = a.row; row <= b.row; row += 1) {
      for (let column = a.column; column <= b.column; column += 1) {
        const isEndpoint =
          (row === a.row && column === a.column) ||
          (row === b.row && column === b.column);
        if (!isEndpoint) {
          cells.add(`${row},${column}`);
        }
      }
    }
    return cells;
  });
  return cellsOf.flatMap((cells, edge) =>
    cellsOf.flatMap((others, other) =>
      edge !== other && [...cells].some((cell) => others.has(cell))
        ? [`${edge}-${other}`]
        : [],
    ),
  );
}

describe("getBridgesNetwork", () => {
  const random = createProblemSeededRandom("bridges-board");
  const boards = Array.from({ length: 200 }, () => createRandomBoard(random));

  test("辺が、同じ行か列で間に島の無い島の組と一致すること", () => {
    const pairs = boards.map((board) =>
      getBridgesNetwork(board)
        .edges.map(({ from, to }) => `${from}-${to}`)
        .sort(),
    );

    expect(pairs).toEqual(
      boards.map((board) => listPairsNaively(board).sort()),
    );
  });

  test("交わる辺が、間のマスの重なる辺の組と一致すること", () => {
    const crossings = boards.map((board) =>
      getBridgesNetwork(board)
        .crossingEdges.flatMap((others, edge) =>
          others.map((other) => `${edge}-${other}`),
        )
        .sort(),
    );

    expect(crossings).toEqual(
      boards.map((board) => listCrossingsNaively(board).sort()),
    );
  });

  test("島ごとの辺が、その島を端に持つ辺と一致すること", () => {
    const islandEdges = boards.map(
      (board) => getBridgesNetwork(board).islandEdges,
    );

    expect(islandEdges).toEqual(
      boards.map((board) => {
        const { edges } = getBridgesNetwork(board);
        return board.islands.map((_, island) =>
          edges.flatMap((edge, index) =>
            edge.from === island || edge.to === island ? [index] : [],
          ),
        );
      }),
    );
  });

  describe("交差のある盤面の場合", () => {
    // 0 . 1
    // . . .
    // 2 . . . 3
    // . . .
    // . . 4
    const board = parseBridgesBoard([
      "1.1..",
      ".....",
      "1...1",
      ".....",
      "..1..",
    ]);

    test("辺を島の順に、右・下の順で並べること", () => {
      const { edges } = getBridgesNetwork(board);

      expect(edges).toEqual([
        { from: 0, to: 1, orientation: "horizontal" },
        { from: 0, to: 2, orientation: "vertical" },
        { from: 1, to: 4, orientation: "vertical" },
        { from: 2, to: 3, orientation: "horizontal" },
      ]);
    });

    test("横と縦の辺が交わること", () => {
      const { crossingEdges } = getBridgesNetwork(board);

      expect(crossingEdges).toEqual([[], [], [3], [2]]);
    });
  });
});

describe("findBridgesEdgeToward", () => {
  const board = parseBridgesBoard([
    "1.1..",
    ".....",
    "1...1",
    ".....",
    "..1..",
  ]);
  const cases = [
    [0, "right", 0],
    [0, "down", 1],
    [0, "left", null],
    [0, "up", null],
    [1, "left", 0],
    [1, "down", 2],
    [4, "up", 2],
    [3, "left", 3],
    [3, "up", null],
  ] as const;

  test.each(cases)(
    "島 %s から %s の辺が %s であること",
    (island, direction, expected) => {
      const edge = findBridgesEdgeToward(board, island, direction);

      expect(edge).toBe(expected);
    },
  );
});

describe("assertBridgesBoard", () => {
  const invalidBoards: readonly [string, BridgesBoard][] = [
    [
      "大きさが0の",
      { width: 0, height: 3, islands: [{ row: 0, column: 0, clue: 1 }] },
    ],
    ["島の無い", { width: 3, height: 3, islands: [] }],
    [
      "盤面の外に島がある",
      { width: 3, height: 3, islands: [{ row: 3, column: 0, clue: 1 }] },
    ],
    [
      "島が行優先に並んでいない",
      {
        width: 3,
        height: 3,
        islands: [
          { row: 2, column: 0, clue: 1 },
          { row: 0, column: 0, clue: 1 },
        ],
      },
    ],
    [
      "数字が0の",
      { width: 3, height: 3, islands: [{ row: 0, column: 0, clue: 0 }] },
    ],
    [
      "数字が9の",
      { width: 3, height: 3, islands: [{ row: 0, column: 0, clue: 9 }] },
    ],
    [
      "島が上下左右に隣り合う",
      {
        width: 3,
        height: 3,
        islands: [
          { row: 0, column: 0, clue: 1 },
          { row: 0, column: 1, clue: 1 },
        ],
      },
    ],
  ];

  test.each(invalidBoards)("%s盤面を拒むこと", (_, board) => {
    const act = () => assertBridgesBoard(board);

    expect(act).toThrow(RangeError);
  });

  describe("斜めに隣り合う島の場合", () => {
    const board: BridgesBoard = {
      width: 3,
      height: 3,
      islands: [
        { row: 0, column: 0, clue: 1 },
        { row: 1, column: 1, clue: 1 },
      ],
    };

    test("受け入れること", () => {
      const act = () => assertBridgesBoard(board);

      expect(act).not.toThrow();
    });
  });
});

describe("parseBridgesBoard", () => {
  const rows = ["2..3", "....", "1.4."];

  test("記法の数字を島の数字として、行優先に読むこと", () => {
    const board = parseBridgesBoard(rows);

    expect(board).toEqual({
      width: 4,
      height: 3,
      islands: [
        { row: 0, column: 0, clue: 2 },
        { row: 0, column: 3, clue: 3 },
        { row: 2, column: 0, clue: 1 },
        { row: 2, column: 2, clue: 4 },
      ],
    });
  });

  test("formatBridgesBoard で同じ記法に戻ること", () => {
    const formatted = formatBridgesBoard(parseBridgesBoard(rows));

    expect(formatted).toEqual(rows);
  });

  test.each([
    ["長さのそろわない行", ["2..", "...."]],
    ["数字でも . でもない文字", ["2.x", "..."]],
  ])("%sを拒むこと", (_, invalidRows) => {
    const act = () => parseBridgesBoard(invalidRows);

    expect(act).toThrow(RangeError);
  });
});

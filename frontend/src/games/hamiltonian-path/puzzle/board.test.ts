import {
  assertHamiltonianPathBoard,
  createHamiltonianPathAdjacency,
  formatHamiltonianPathBoard,
  getHamiltonianPathNeighborCell,
  type HamiltonianPathBoard,
  type HamiltonianPathDirection,
  listHamiltonianPathOpenCells,
  normalizeHamiltonianPathPartitions,
  parseHamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";

describe("parseHamiltonianPathBoard", () => {
  const rows = ["S .|.", "-    ", ". # .", "    -", ". . ."];

  test("壁マス・始点・左右と上下の仕切りを読み取ること", () => {
    const board = parseHamiltonianPathBoard(rows);

    expect(board).toEqual({
      size: 3,
      walls: [4],
      partitions: [
        [0, 3],
        [1, 2],
        [5, 8],
      ],
      start: 0,
    });
  });

  const invalidNotations: readonly [string, readonly string[]][] = [
    ["始点が無い", [". .", "   ", ". ."]],
    ["始点が2つある", ["S S", "   ", ". ."]],
    ["行の数が偶数", ["S .", "   "]],
    ["知らない記号がある", ["S x", "   ", ". ."]],
    ["壁マスに接する仕切りがある", ["S|#", "   ", ". ."]],
  ];

  test.each(invalidNotations)("%s記法を拒否すること", (_, invalidRows) => {
    const act = () => parseHamiltonianPathBoard(invalidRows);

    expect(act).toThrow();
  });
});

describe("formatHamiltonianPathBoard", () => {
  const rows = ["S .|.", "-    ", ". # .", "    -", ". . ."];
  const board = parseHamiltonianPathBoard(rows);

  test("読み取った記法と同じ行に書き戻すこと", () => {
    const formatted = formatHamiltonianPathBoard(board);

    expect(formatted).toEqual(rows);
  });
});

describe("assertHamiltonianPathBoard", () => {
  const validBoard: HamiltonianPathBoard = {
    size: 3,
    walls: [4],
    partitions: [[0, 1]],
    start: 0,
  };
  const invalidBoards: readonly [string, HamiltonianPathBoard][] = [
    ["始点が壁マス", { ...validBoard, start: 4 }],
    ["始点が盤面の外", { ...validBoard, start: 9 }],
    ["壁マスが昇順でない", { ...validBoard, walls: [5, 4] }],
    [
      "仕切りが隣り合わないマスの間にある",
      { ...validBoard, partitions: [[0, 2]] },
    ],
    ["仕切りが行の端をまたぐ", { ...validBoard, partitions: [[2, 3]] }],
    ["仕切りのマスの順が逆", { ...validBoard, partitions: [[1, 0]] }],
    [
      "仕切りが重複する",
      {
        ...validBoard,
        partitions: [
          [0, 1],
          [0, 1],
        ],
      },
    ],
  ];

  test("形の正しい盤面を受け入れること", () => {
    const act = () => assertHamiltonianPathBoard(validBoard);

    expect(act).not.toThrow();
  });

  test.each(invalidBoards)("%s盤面を拒否すること", (_, invalidBoard) => {
    const act = () => assertHamiltonianPathBoard(invalidBoard);

    expect(act).toThrow();
  });
});

describe("getHamiltonianPathNeighborCell", () => {
  const cases: readonly [number, HamiltonianPathDirection, number | null][] = [
    [4, "up", 1],
    [4, "right", 5],
    [4, "down", 7],
    [4, "left", 3],
    [0, "up", null],
    [2, "right", null],
    [6, "down", null],
    [3, "left", null],
  ];

  test.each(cases)(
    "3×3 のマス %i から %s の隣が %s であること",
    (cell, direction, expected) => {
      const neighbor = getHamiltonianPathNeighborCell(3, cell, direction);

      expect(neighbor).toBe(expected);
    },
  );
});

describe("normalizeHamiltonianPathPartitions", () => {
  const partitions = [
    [4, 3],
    [0, 1],
    [3, 4],
  ] as const;

  test("マスの組を小さい順にし、昇順に並べて重複を除くこと", () => {
    const normalized = normalizeHamiltonianPathPartitions(partitions);

    expect(normalized).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });
});

describe("createHamiltonianPathAdjacency", () => {
  const board = parseHamiltonianPathBoard([
    "S .|.",
    "-    ",
    ". # .",
    "     ",
    ". . .",
  ]);

  test("壁マスと仕切りの向こうを除いた隣を上・右・下・左の順に返すこと", () => {
    const adjacency = createHamiltonianPathAdjacency(board);

    expect(adjacency[0]).toEqual([1]);
    expect(adjacency[1]).toEqual([0]);
    expect(adjacency[3]).toEqual([6]);
    expect(adjacency[4]).toEqual([]);
    expect(adjacency[5]).toEqual([2, 8]);
  });
});

describe("listHamiltonianPathOpenCells", () => {
  const board = parseHamiltonianPathBoard(["S #", "   ", "# ."]);

  test("壁マスを除いたマスを昇順に返すこと", () => {
    const openCells = listHamiltonianPathOpenCells(board);

    expect(openCells).toEqual([0, 3]);
  });
});

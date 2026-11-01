import {
  assertHitofudePuzzleBoard,
  createHitofudePuzzleAdjacency,
  findHitofudePuzzleDirection,
  formatHitofudePuzzleBoard,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleBoard,
  type HitofudePuzzleDirection,
  listHitofudePuzzleOpenCells,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";

describe("parseHitofudePuzzleBoard", () => {
  const rows = ["S . .", ". # .", "# . ."];

  test("穴・始点を読み取ること", () => {
    const board = parseHitofudePuzzleBoard(rows);

    expect(board).toEqual({ size: 3, holes: [4, 6], start: 0 });
  });

  const invalidNotations: readonly [string, readonly string[]][] = [
    ["始点が無い", [". .", ". ."]],
    ["始点が2つある", ["S S", ". ."]],
    ["行のマスの数が行の数と違う", ["S . .", ". . ."]],
    ["マスを空白で区切らない", ["S.", ".."]],
    ["知らない記号がある", ["S x", ". ."]],
  ];

  test.each(invalidNotations)("%s記法を拒否すること", (_, invalidRows) => {
    const act = () => parseHitofudePuzzleBoard(invalidRows);

    expect(act).toThrow();
  });
});

describe("formatHitofudePuzzleBoard", () => {
  const rows = ["S . .", ". # .", "# . ."];
  const board = parseHitofudePuzzleBoard(rows);

  test("読み取った記法と同じ行に書き戻すこと", () => {
    const formatted = formatHitofudePuzzleBoard(board);

    expect(formatted).toEqual(rows);
  });
});

describe("assertHitofudePuzzleBoard", () => {
  const validBoard: HitofudePuzzleBoard = { size: 3, holes: [4], start: 0 };
  const invalidBoards: readonly [string, HitofudePuzzleBoard][] = [
    ["始点が穴の", { ...validBoard, start: 4 }],
    ["始点が枠の外の", { ...validBoard, start: 9 }],
    ["穴が昇順でない", { ...validBoard, holes: [5, 4] }],
    ["穴が重複する", { ...validBoard, holes: [4, 4] }],
    ["穴が枠の外にある", { ...validBoard, holes: [4, 9] }],
  ];

  test("形の正しい盤面を受け入れること", () => {
    const act = () => assertHitofudePuzzleBoard(validBoard);

    expect(act).not.toThrow();
  });

  test.each(invalidBoards)("%s盤面を拒否すること", (_, invalidBoard) => {
    const act = () => assertHitofudePuzzleBoard(invalidBoard);

    expect(act).toThrow();
  });
});

describe("getHitofudePuzzleNeighborCell", () => {
  const cases: readonly [number, HitofudePuzzleDirection, number | null][] = [
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
      const neighbor = getHitofudePuzzleNeighborCell(3, cell, direction);

      expect(neighbor).toBe(expected);
    },
  );
});

describe("findHitofudePuzzleDirection", () => {
  const cases: readonly [number, number, HitofudePuzzleDirection | null][] = [
    [4, 1, "up"],
    [4, 5, "right"],
    [4, 7, "down"],
    [4, 3, "left"],
    [4, 0, null],
    [2, 3, null],
    [4, 4, null],
  ];

  test.each(cases)(
    "3×3 のマス %i から見たマス %i の向きが %s であること",
    (from, to, expected) => {
      const direction = findHitofudePuzzleDirection(3, from, to);

      expect(direction).toBe(expected);
    },
  );
});

describe("createHitofudePuzzleAdjacency", () => {
  const board = parseHitofudePuzzleBoard(["S . .", ". # .", ". . #"]);

  test("穴を除いた隣を上・右・下・左の順に返すこと", () => {
    const adjacency = createHitofudePuzzleAdjacency(board);

    expect(adjacency[0]).toEqual([1, 3]);
    expect(adjacency[1]).toEqual([2, 0]);
    expect(adjacency[4]).toEqual([]);
    expect(adjacency[5]).toEqual([2]);
    expect(adjacency[7]).toEqual([6]);
  });
});

describe("listHitofudePuzzleOpenCells", () => {
  const board = parseHitofudePuzzleBoard(["S #", "# ."]);

  test("穴を除いたマスを昇順に返すこと", () => {
    const openCells = listHitofudePuzzleOpenCells(board);

    expect(openCells).toEqual([0, 3]);
  });
});

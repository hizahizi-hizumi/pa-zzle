import {
  assertIceFloorMazeBoard,
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
  isIceFloorMazeIceCell,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";

describe("parseIceFloorMazeBoard", () => {
  const rows = ["..#", "#..", "...", "..."];

  test("行優先で氷と岩を並べ、列数を幅・行数を高さにすること", () => {
    const board = parseIceFloorMazeBoard(rows);

    expect(board.width).toBe(3);
    expect(board.height).toBe(4);
    expect(board.cells.slice(0, 6)).toEqual([
      "ice",
      "ice",
      "rock",
      "rock",
      "ice",
      "ice",
    ]);
  });

  const invalidCases = [
    ["行の長さが揃わない", ["...", ".."]],
    ["知らない記号がある", ["..o", "..."]],
    ["行が無い", []],
  ] as const;

  test.each(invalidCases)("%s記法を拒否すること", (_, invalidRows) => {
    function act() {
      parseIceFloorMazeBoard(invalidRows);
    }

    expect(act).toThrow();
  });
});

describe("assertIceFloorMazeBoard", () => {
  const invalidCases = [
    ["マス数が幅×高さと合わない", { width: 2, height: 2, cells: ["ice"] }],
    ["幅が整数でない", { width: 1.5, height: 2, cells: ["ice", "ice"] }],
    ["氷と岩以外のマスがある", { width: 1, height: 1, cells: ["floor"] }],
  ] as const;

  test.each(invalidCases)("%s盤面を拒否すること", (_, board) => {
    function act() {
      assertIceFloorMazeBoard(board as unknown as IceFloorMazeBoard);
    }

    expect(act).toThrow();
  });
});

describe("isIceFloorMazeIceCell", () => {
  const board = parseIceFloorMazeBoard([".#", ".."]);
  const cases = [
    ["氷のマス", 0, true],
    ["岩のマス", 1, false],
    ["盤面の外", 4, false],
    ["負の番号", -1, false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, cellIndex, expected) => {
    const result = isIceFloorMazeIceCell(board, cellIndex);

    expect(result).toBe(expected);
  });
});

describe("getIceFloorMazeCellPosition", () => {
  const board = parseIceFloorMazeBoard(["...", "...", "...", "..."]);

  test("マスの番号を y * width + x として列と行に分けること", () => {
    const position = getIceFloorMazeCellPosition(board, 7);

    expect(position).toEqual({ x: 1, y: 2 });
  });
});

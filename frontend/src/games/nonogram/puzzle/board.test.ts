import {
  createEmptyNonogramBoard,
  getNonogramLineCellIndices,
  getNonogramLineCellStates,
  listNonogramLines,
  parseNonogramBoard,
  setNonogramCellState,
} from "@/games/nonogram/puzzle/board";

describe("createEmptyNonogramBoard", () => {
  test("すべてのマスを未確定にした盤面を作ること", () => {
    const board = createEmptyNonogramBoard({ width: 3, height: 2 });

    expect(board).toEqual({
      width: 3,
      height: 2,
      cells: new Array(6).fill("unknown"),
    });
  });

  test.each([
    ["幅が0", { width: 0, height: 2 }],
    ["高さが整数でない", { width: 2, height: 1.5 }],
  ])("%sの大きさを拒否すること", (_, size) => {
    const act = () => createEmptyNonogramBoard(size);

    expect(act).toThrow(RangeError);
  });
});

describe("parseNonogramBoard", () => {
  test("`.` を未確定、`#` を塗り、`x` を × として読むこと", () => {
    const board = parseNonogramBoard(["#x.", "..#"]);

    expect(board).toEqual({
      width: 3,
      height: 2,
      cells: ["filled", "crossed", "unknown", "unknown", "unknown", "filled"],
    });
  });

  test.each([
    ["幅のそろわない行", ["##", "#"]],
    ["知らない記号", ["#?"]],
  ])("%sを拒否すること", (_, rows) => {
    const act = () => parseNonogramBoard(rows);

    expect(act).toThrow(RangeError);
  });
});

describe("listNonogramLines", () => {
  test("行を上から並べ、続けて列を左から並べること", () => {
    const lines = listNonogramLines({ width: 2, height: 3 });

    expect(lines).toEqual([
      { axis: "row", index: 0 },
      { axis: "row", index: 1 },
      { axis: "row", index: 2 },
      { axis: "column", index: 0 },
      { axis: "column", index: 1 },
    ]);
  });
});

describe("getNonogramLineCellIndices", () => {
  const size = { width: 3, height: 4 };
  const cases = [
    ["行は左から", { axis: "row", index: 2 }, [6, 7, 8]],
    ["列は上から", { axis: "column", index: 1 }, [1, 4, 7, 10]],
  ] as const;

  test.each(cases)("%s順にマスの位置を返すこと", (_, line, expected) => {
    const cellIndices = getNonogramLineCellIndices(size, line);

    expect(cellIndices).toEqual(expected);
  });
});

describe("getNonogramLineCellStates", () => {
  const board = parseNonogramBoard(["#x.", "..#"]);

  test("列のマスの状態を上から返すこと", () => {
    const states = getNonogramLineCellStates(board, {
      axis: "column",
      index: 2,
    });

    expect(states).toEqual(["unknown", "filled"]);
  });
});

describe("setNonogramCellState", () => {
  const board = parseNonogramBoard(["#x.", "..#"]);

  test("1マスの状態だけを変えた新しい盤面を返すこと", () => {
    const next = setNonogramCellState(board, 2, "crossed");

    expect(next).toEqual(parseNonogramBoard(["#xx", "..#"]));
    expect(board).toEqual(parseNonogramBoard(["#x.", "..#"]));
  });

  test.each([
    ["すでに同じ状態のマス", 0],
    ["盤面外のマス", 6],
  ])("%sでは同じ盤面をそのまま返すこと", (_, cellIndex) => {
    const next = setNonogramCellState(board, cellIndex, "filled");

    expect(next).toBe(board);
  });
});

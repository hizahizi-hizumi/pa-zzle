import { parseReflectionBoard } from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  getReflectionLeavingDirection,
  listReflectionEntries,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";

describe("getReflectionLeavingDirection", () => {
  const cases = [
    [null, 1, 1],
    ["slash", 0, 1],
    ["slash", 2, 3],
    ["backslash", 0, 3],
    ["backslash", 1, 2],
    ["vertical-double", 0, 0],
    ["vertical-double", 1, 3],
    ["horizontal-double", 1, 1],
    ["horizontal-double", 2, 0],
    ["reflector", 3, 1],
    ["black-hole", 2, null],
  ] as const;

  test.each(cases)(
    "%s のマスへ向き %i で入った光が向き %s で出ること",
    (cell, entering, expected) => {
      const result = getReflectionLeavingDirection(cell, entering);

      expect(result).toBe(expected);
    },
  );
});

describe("listReflectionEntries", () => {
  test("上辺・右辺・下辺・左辺の順に各辺の位置を並べること", () => {
    const result = listReflectionEntries(2);

    expect(result).toEqual([
      { side: "top", index: 0 },
      { side: "top", index: 1 },
      { side: "right", index: 0 },
      { side: "right", index: 1 },
      { side: "bottom", index: 0 },
      { side: "bottom", index: 1 },
      { side: "left", index: 0 },
      { side: "left", index: 1 },
    ]);
  });
});

describe("traceReflectionLaser", () => {
  const cases = [
    ["空の盤面を直進する", ["...", "...", "..."], "top", 1, "exit", 3],
    [
      "斜め鏡で曲がって左辺から出る",
      ["...", "./.", "..."],
      "top",
      1,
      "exit",
      3,
    ],
    ["入ったマスの反射体で戻る", ["o..", "...", "..."], "top", 0, "reflect", 1],
    [
      "ブラックホールのマスまで数える",
      ["...", "...", ".@."],
      "left",
      2,
      "absorb",
      2,
    ],
    [
      "両面鏡の鏡面に沿って素通りする",
      ["...", ".|.", "..."],
      "top",
      1,
      "exit",
      3,
    ],
    [
      "両面鏡で戻り、同じマスを2度数える",
      ["...", ".|.", "..."],
      "left",
      1,
      "reflect",
      3,
    ],
  ] as const;

  test.each(cases)(
    "%s こと",
    (_, rows, side, index, expectedOutcome, expectedDistance) => {
      const result = traceReflectionLaser(parseReflectionBoard(rows), {
        side,
        index,
      });

      expect(result.outcome).toBe(expectedOutcome);
      expect(result.distance).toBe(expectedDistance);
    },
  );

  describe("光路", () => {
    const board = parseReflectionBoard(["...", "./.", "..."]);

    test("通ったマスと、マスへ入る向き・出る向きを順に返すこと", () => {
      const result = traceReflectionLaser(board, { side: "top", index: 1 });

      expect(result.path).toEqual([
        { cellIndex: 1, entering: 2, leaving: 2 },
        { cellIndex: 4, entering: 2, leaving: 3 },
        { cellIndex: 3, entering: 3, leaving: 3 },
      ]);
      expect(result.exit).toEqual({ side: "left", index: 1 });
    });
  });
});

describe("computeReflectionClues", () => {
  const board = parseReflectionBoard(["o.", ".."]);

  test("外周の全位置のヒントを listReflectionEntries の順に返すこと", () => {
    const result = computeReflectionClues(board);

    expect(result).toEqual([
      { outcome: "reflect", distance: 1 },
      { outcome: "exit", distance: 2 },
      { outcome: "reflect", distance: 3 },
      { outcome: "exit", distance: 2 },
      { outcome: "reflect", distance: 3 },
      { outcome: "exit", distance: 2 },
      { outcome: "reflect", distance: 1 },
      { outcome: "exit", distance: 2 },
    ]);
  });
});

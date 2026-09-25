import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  isTakuzuSolved,
  listTakuzuViolatedCellIndices,
} from "@/games/takuzu/puzzle/rules";

const solvedBoard = parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BABA"]);

describe("findTakuzuRuleViolations", () => {
  describe("ルールを満たす途中の盤面の場合", () => {
    const board = parseTakuzuBoard(["AA.B", "B..A", "....", "...."]);

    test("違反を返さないこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result).toEqual({
        runCellIndices: [],
        overfilledLines: [],
        duplicateLines: [],
      });
    });
  });

  describe("同じタイルが3つ続く場合", () => {
    const board = parseTakuzuBoard(["B...", "BAAA", "B...", "...."]);

    test("続いているマスを横と縦の両方で返すこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.runCellIndices).toEqual([0, 4, 5, 6, 7, 8]);
    });
  });

  describe("空きマスをはさんで同じタイルが並ぶ場合", () => {
    const board = parseTakuzuBoard(["AA.A", "....", "....", "...."]);

    test("3連続として扱わないこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.runCellIndices).toEqual([]);
    });
  });

  describe("一辺の半分を超えてタイルを置いた場合", () => {
    const board = parseTakuzuBoard(["A.AA", "....", "A...", "...."]);

    test("超えた行・列を返すこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.overfilledLines).toEqual([{ axis: "row", index: 0 }]);
    });
  });

  describe("埋まった2行の並びが一致する場合", () => {
    const board = parseTakuzuBoard(["ABAB", "ABAB", "....", "...."]);

    test("一致した行を返すこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.duplicateLines).toEqual([
        { axis: "row", index: 0 },
        { axis: "row", index: 1 },
      ]);
    });
  });

  describe("埋まった2列の並びが一致する場合", () => {
    const board = parseTakuzuBoard(["AA..", "BB..", "AA..", "BB.."]);

    test("一致した列を返すこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.duplicateLines).toEqual([
        { axis: "column", index: 0 },
        { axis: "column", index: 1 },
      ]);
    });
  });

  describe("埋まっていない行の並びが一致する場合", () => {
    const board = parseTakuzuBoard(["AB.B", "AB.B", "....", "...."]);

    test("重複として扱わないこと", () => {
      const result = findTakuzuRuleViolations(board);

      expect(result.duplicateLines).toEqual([]);
    });
  });
});

describe("listTakuzuViolatedCellIndices", () => {
  const board = parseTakuzuBoard(["AAA.", "....", "....", "...."]);
  const violations = findTakuzuRuleViolations(board);

  test("3連続のマスと個数を超えた行のマスを重複なく返すこと", () => {
    const result = listTakuzuViolatedCellIndices(board.size, violations);

    expect(result).toEqual([0, 1, 2, 3]);
  });
});

describe("isTakuzuSolved", () => {
  const cases = [
    ["ルールを満たして全マスが埋まった盤面", solvedBoard, true],
    [
      "空きマスが残る盤面",
      parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BAB."]),
      false,
    ],
    [
      "全マスが埋まっても3連続がある盤面",
      parseTakuzuBoard(["AABB", "ABBA", "ABAB", "BAAB"]),
      false,
    ],
    [
      "全マスが埋まっても行が重複する盤面",
      parseTakuzuBoard(["ABAB", "BABA", "ABAB", "BABA"]),
      false,
    ],
  ] as const;

  test.each(cases)("%s の完成を判定すること", (_, board, expected) => {
    const result = isTakuzuSolved(board);

    expect(result).toBe(expected);
  });
});

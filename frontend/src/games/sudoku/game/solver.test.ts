import { describe, expect, test } from "vitest";

import { isSudokuBoardConsistent, isSudokuSolved } from "./rules";
import { classifySudokuSolutions, findSudokuSolution } from "./solver";
import type { SudokuBoard, SudokuCell } from "./state";

function boardFromRows(rows: readonly string[]): SudokuBoard {
  return rows.flatMap((row) =>
    [...row].map<SudokuCell>((cell) =>
      cell === "0" ? null : (Number(cell) as SudokuCell),
    ),
  );
}

const uniquePuzzle = boardFromRows([
  "530070000",
  "600195000",
  "098000060",
  "800060003",
  "400803001",
  "700020006",
  "060000280",
  "000419005",
  "000080079",
]);

const expectedSolution = boardFromRows([
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
]);

describe("classifySudokuSolutions", () => {
  test("一意解の盤面から完成解を取得すること", () => {
    const result = classifySudokuSolutions(uniquePuzzle);

    expect(result).toEqual({ status: "unique", solution: expectedSolution });
  });

  test("一意解問題へ誤ったヒントを追加した盤面を解なしと判定すること", () => {
    const unsolvable = [...uniquePuzzle];
    unsolvable[2] = 1;

    const consistent = isSudokuBoardConsistent(unsolvable);
    const result = classifySudokuSolutions(unsolvable);

    expect(consistent).toBe(true);
    expect(result).toEqual({ status: "unsolvable" });
  });

  test("空盤面を複数解と判定すること", () => {
    const emptyBoard = Array.from({ length: 81 }, () => null);

    const result = classifySudokuSolutions(emptyBoard);

    expect(result).toEqual({ status: "multiple" });
  });
});

describe("findSudokuSolution", () => {
  test("最初の完成解を取得できること", () => {
    const solution = findSudokuSolution(uniquePuzzle);

    expect(solution).toEqual(expectedSolution);
  });

  test("探索元の盤面を変更しないこと", () => {
    const board = [...uniquePuzzle];
    const before = [...board];

    findSudokuSolution(board);

    expect(board).toEqual(before);
  });

  test("空盤面から妥当な完成盤を構成できること", () => {
    const emptyBoard = Array.from({ length: 81 }, () => null);
    const randomValues = [0.1, 0.7, 0.3, 0.9];
    let randomIndex = 0;
    const random = () => {
      const value = randomValues[randomIndex % randomValues.length]!;
      randomIndex += 1;
      return value;
    };

    const solution = findSudokuSolution(emptyBoard, { random });
    const solved = solution ? isSudokuSolved(solution) : false;

    expect(solved).toBe(true);
  });
});

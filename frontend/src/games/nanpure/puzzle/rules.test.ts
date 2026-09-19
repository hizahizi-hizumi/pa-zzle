import { describe, expect, test } from "vitest";
import type { NanpureBoard, NanpureCell } from "./board";
import {
  findNanpureConflictCellIndices,
  getNanpureCandidates,
  isNanpureBoardConsistent,
  isNanpureSolved,
} from "./rules";

function boardFromRows(rows: readonly string[]): NanpureBoard {
  return rows.flatMap((row) =>
    [...row].map<NanpureCell>((cell) =>
      cell === "0" ? null : (Number(cell) as NanpureCell),
    ),
  );
}

const problemClues = boardFromRows([
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

const solution = boardFromRows([
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

describe("getNanpureCandidates", () => {
  test("行・列・ブロックの制約から候補数字を算出すること", () => {
    const candidates = getNanpureCandidates(problemClues, 2);

    expect(candidates).toEqual([1, 2, 4]);
  });

  test("入力済みのマスには候補数字を返さないこと", () => {
    const candidates = getNanpureCandidates(problemClues, 0);

    expect(candidates).toEqual([]);
  });
});

test("競合する数字に関わる全てのマスを返すこと", () => {
  const board = Array.from({ length: 81 }, () => null) as NanpureCell[];
  board[0] = 5;
  board[1] = 5;
  board[9] = 5;

  const conflicts = findNanpureConflictCellIndices(board);

  expect(conflicts).toEqual([0, 1, 9]);
});

test("競合のない途中盤面を妥当と判定すること", () => {
  const consistent = isNanpureBoardConsistent(problemClues);

  expect(consistent).toBe(true);
});

describe("isNanpureSolved", () => {
  test("全制約を満たす完成盤をクリアと判定すること", () => {
    const solved = isNanpureSolved(solution);

    expect(solved).toBe(true);
  });

  test("空きマスのある盤面をクリアと判定しないこと", () => {
    const solved = isNanpureSolved(problemClues);

    expect(solved).toBe(false);
  });
});

import type { NanpureBoard, NanpureCell } from "@/games/nanpure/puzzle/board";
import {
  findNanpureConflictCellIndices,
  findNanpureUnitsCompletedAt,
  getNanpureCandidates,
  getNanpureUnitCellIndices,
  isNanpureBoardConsistent,
  isNanpureSolved,
} from "@/games/nanpure/puzzle/rules";

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

  test("選んだ種類のまとまりの数字だけを除いて候補数字を算出すること", () => {
    const candidates = getNanpureCandidates(problemClues, 2, ["row"]);

    expect(candidates).toEqual([1, 2, 4, 6, 8, 9]);
  });

  test("入力済みのマスには候補数字を返さないこと", () => {
    const candidates = getNanpureCandidates(problemClues, 0);

    expect(candidates).toEqual([]);
  });
});

describe("findNanpureConflictCellIndices", () => {
  const board = Array.from({ length: 81 }, (_, cellIndex) =>
    [0, 1, 9].includes(cellIndex) ? 5 : null,
  ) as NanpureCell[];
  const unitKindCases = [
    [["row"], [0, 1]],
    [["column"], [0, 9]],
    [["block"], [0, 1, 9]],
  ] as const;

  test("競合する数字に関わる全てのマスを返すこと", () => {
    const conflicts = findNanpureConflictCellIndices(board);

    expect(conflicts).toEqual([0, 1, 9]);
  });

  test.each(unitKindCases)(
    "選んだ種類のまとまりの中で競合するマスだけを返すこと: %s",
    (unitKinds, expected) => {
      const conflicts = findNanpureConflictCellIndices(board, unitKinds);

      expect(conflicts).toEqual(expected);
    },
  );
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

describe("findNanpureUnitsCompletedAt", () => {
  const completedBoard = solution.map((cell, cellIndex) =>
    cellIndex === 0 ? null : cell,
  );
  const unfinishedBoard = solution.map((cell, cellIndex) =>
    cellIndex === 0 || cellIndex === 80 ? null : cell,
  );
  const mistakenBoard = solution.map((cell, cellIndex) =>
    cellIndex === 8 ? 1 : cellIndex === 0 ? null : cell,
  );

  test("入れたマスを含む、解どおりに埋まった行・列・ブロックを返すこと", () => {
    const units = findNanpureUnitsCompletedAt(completedBoard, solution, 80);

    expect(units).toEqual([
      { kind: "row", index: 8 },
      { kind: "column", index: 8 },
      { kind: "block", index: 8 },
    ]);
  });

  test("空きのあるまとまりを返さないこと", () => {
    const units = findNanpureUnitsCompletedAt(unfinishedBoard, solution, 72);

    expect(units).toEqual([{ kind: "block", index: 6 }]);
  });

  test("解と違う数字を含むまとまりを返さないこと", () => {
    const units = findNanpureUnitsCompletedAt(mistakenBoard, solution, 17);

    expect(units).toEqual([{ kind: "row", index: 1 }]);
  });
});

describe("getNanpureUnitCellIndices", () => {
  const cases = [
    [{ kind: "column", index: 2 }, [2, 11, 20, 29, 38, 47, 56, 65, 74]],
    [{ kind: "block", index: 4 }, [30, 31, 32, 39, 40, 41, 48, 49, 50]],
  ] as const;

  test.each(cases)(
    "まとまりのマスを端から順に返すこと: %o",
    (unit, expected) => {
      const cellIndices = getNanpureUnitCellIndices(unit);

      expect(cellIndices).toEqual(expected);
    },
  );
});

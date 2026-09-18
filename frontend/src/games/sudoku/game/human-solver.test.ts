import { describe, expect, test } from "vitest";

import { traceSudokuHumanSolve } from "./human-solver";
import { classifySudokuSolutions } from "./solver";
import type { SudokuBoard, SudokuCell } from "./state";

function boardFromRows(rows: readonly string[]): SudokuBoard {
  return rows.flatMap((row) =>
    [...row].map<SudokuCell>((cell) =>
      cell === "0" ? null : (Number(cell) as SudokuCell),
    ),
  );
}

const basicPuzzle = boardFromRows([
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

const hiddenSinglePuzzle = boardFromRows([
  "000608000",
  "000000308",
  "000300067",
  "009001400",
  "420800001",
  "010900000",
  "001000000",
  "200019000",
  "300286009",
]);

const advancedPuzzle = boardFromRows([
  "100007090",
  "030020008",
  "009600500",
  "005300900",
  "010080002",
  "600004000",
  "300000010",
  "040000007",
  "007000300",
]);

describe("traceSudokuHumanSolve", () => {
  test("基礎手筋だけで解ける問題を最後まで解くこと", () => {
    const result = traceSudokuHumanSolve(basicPuzzle);

    expect(result.status).toBe("solved");
    expect(result.board).toEqual(expectedSolution);
    expect(result.features.solvedWithSupportedTechniques).toBe(true);
    expect(result.features.stepCount).toBe(result.steps.length);
  });

  test("対応済み手筋で進めなくなった問題を推測せず停止すること", () => {
    const classification = classifySudokuSolutions(advancedPuzzle);
    const result = traceSudokuHumanSolve(advancedPuzzle);

    expect(classification.status).toBe("unique");
    expect(result.status).toBe("stalled");
    expect(result.features.solvedWithSupportedTechniques).toBe(false);
    expect(result.board).not.toEqual(expectedSolution);
  });

  test("同じ盤面から同じ解法トレースを再現すること", () => {
    const first = traceSudokuHumanSolve(basicPuzzle);
    const second = traceSudokuHumanSolve(basicPuzzle);

    expect(second).toEqual(first);
  });

  test("解法元の盤面を変更しないこと", () => {
    const board = [...basicPuzzle];
    const before = [...board];

    traceSudokuHumanSolve(board);

    expect(board).toEqual(before);
  });

  test("各手順に順序と候補変化を記録すること", () => {
    const result = traceSudokuHumanSolve(basicPuzzle);
    const firstStep = result.steps[0]!;

    expect(firstStep.order).toBe(1);
    expect(firstStep.candidatesBefore).toContain(firstStep.digit);
    expect(firstStep.candidateChanges).toContainEqual(
      expect.objectContaining({
        cellIndex: firstStep.cellIndex,
        before: firstStep.candidatesBefore,
        after: [],
      }),
    );
  });

  test("手筋ごとの使用回数を特徴量として集計すること", () => {
    const result = traceSudokuHumanSolve(basicPuzzle);
    const countedSteps =
      result.features.techniqueCounts["naked-single"] +
      result.features.techniqueCounts["hidden-single"];

    expect(countedSteps).toBe(result.features.stepCount);
    expect(result.features.usedTechniques).toEqual(
      result.features.techniqueCounts["hidden-single"] > 0
        ? ["naked-single", "hidden-single"]
        : ["naked-single"],
    );
  });

  test("Hidden Singleの成立単位と候補位置を記録すること", () => {
    const result = traceSudokuHumanSolve(hiddenSinglePuzzle);
    const firstStep = result.steps[0];

    expect(firstStep).toMatchObject({
      order: 1,
      technique: "hidden-single",
      cellIndex: 12,
      digit: 1,
      candidatesBefore: [1, 4, 5, 7],
      unit: { kind: "column", index: 3 },
      unitCandidateCellIndices: [12],
    });
  });

  test("解法序盤の次の一手候補数を依存構造の特徴量として集計すること", () => {
    const result = traceSudokuHumanSolve(basicPuzzle);
    const observedSteps = result.steps.slice(0, 25);
    const availablePlacementCounts = observedSteps.map(
      (step) => step.availablePlacementCount,
    );

    expect(result.features.dependency.observedStepCount).toBe(
      observedSteps.length,
    );
    expect(result.features.dependency.meanAvailablePlacementCount).toBe(
      availablePlacementCounts.reduce((sum, count) => sum + count, 0) /
        availablePlacementCounts.length,
    );
    expect(result.features.dependency.minimumAvailablePlacementCount).toBe(
      Math.min(...availablePlacementCounts),
    );
    expect(result.features.dependency.singleOptionStepCount).toBe(
      availablePlacementCounts.filter((count) => count === 1).length,
    );
  });
});

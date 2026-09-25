import { cleanup, render } from "@testing-library/react";

import { minesweeperDifficulties } from "@/games/minesweeper/difficulty";
import {
  _private,
  MinesweeperDifficultyPreview,
} from "@/games/minesweeper/ui/MinesweeperDifficultyPreview";

const { previewMineLayouts, createPreviewCells } = _private;

afterEach(cleanup);

function toMineCellKeys(layout: readonly string[]): string[] {
  return layout.flatMap(function toRowMineKeys(rowMarks, row) {
    return Array.from(rowMarks).flatMap(function toMineKey(mark, column) {
      return mark === "*" ? [`${row}-${column}`] : [];
    });
  });
}

function getMaximumNumber(
  cells: ReturnType<typeof createPreviewCells>,
): number {
  return Math.max(
    ...cells.map(function toNumber(cell) {
      return cell.state === "revealed" ? cell.adjacentMineCount : 0;
    }),
  );
}

describe("previewMineLayouts", () => {
  const adjacentDifficulties = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const;

  test.each(adjacentDifficulties)(
    "レベル %s の地雷をレベル %s がすべて含むこと",
    (lower, higher) => {
      const lowerMines = toMineCellKeys(previewMineLayouts[lower]);
      const higherMines = toMineCellKeys(previewMineLayouts[higher]);

      expect(higherMines).toEqual(expect.arrayContaining(lowerMines));
    },
  );

  test.each(adjacentDifficulties)(
    "レベル %s よりレベル %s の列と地雷が多いこと",
    (lower, higher) => {
      const lowerLayout = previewMineLayouts[lower];
      const higherLayout = previewMineLayouts[higher];

      expect(higherLayout[0]?.length).toBeGreaterThan(
        lowerLayout[0]?.length ?? 0,
      );
      expect(toMineCellKeys(higherLayout).length).toBeGreaterThan(
        toMineCellKeys(lowerLayout).length,
      );
    },
  );
});

describe("createPreviewCells", () => {
  const difficulties = minesweeperDifficulties.map(function toId({ id }) {
    return id;
  });
  const adjacentDifficulties = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const;

  test.each(adjacentDifficulties)(
    "レベル %s よりレベル %s の最大の数字が大きいこと",
    (lower, higher) => {
      const lowerCells = createPreviewCells(lower);
      const higherCells = createPreviewCells(higher);

      expect(getMaximumNumber(higherCells)).toBeGreaterThan(
        getMaximumNumber(lowerCells),
      );
    },
  );

  test.each(difficulties)(
    "レベル %s の中段を最後の1マスを除いて開示すること",
    (difficulty) => {
      const cells = createPreviewCells(difficulty);

      const columns = previewMineLayouts[difficulty][1]?.length ?? 0;
      const middleRow = cells.slice(columns, columns * 2);

      expect(
        middleRow.slice(0, -1).every(function isRevealed(cell) {
          return cell.state === "revealed";
        }),
      ).toBe(true);
      expect(middleRow.at(-1)?.state).toBe("hidden");
    },
  );
});

describe("MinesweeperDifficultyPreview", () => {
  const cases = [
    ["1", "1 1 1"],
    ["5", "3 5 5 4 4 3 2"],
  ] as const;

  test.each(cases)(
    "レベル %s の中段に隣接地雷数の数字を表示すること",
    (difficulty, expectedNumbers) => {
      const { container } = render(
        <MinesweeperDifficultyPreview difficulty={difficulty} />,
      );

      const numbers = Array.from(
        container.querySelectorAll("span > span > span"),
      )
        .map(function toText(cell) {
          return cell.textContent;
        })
        .filter(Boolean)
        .join(" ");

      expect(numbers).toBe(expectedNumbers);
    },
  );
});

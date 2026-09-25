import { cleanup, render } from "@testing-library/react";

import {
  minesweeperDifficulties,
  minesweeperDifficultyBoardRanges,
} from "@/games/minesweeper/difficulty";
import {
  _private,
  MinesweeperDifficultyPreview,
} from "@/games/minesweeper/ui/MinesweeperDifficultyPreview";

const { previewMineLayouts } = _private;

afterEach(cleanup);

function countCells(layout: readonly string[]): number {
  return layout.join("").length;
}

function countMines(layout: readonly string[]): number {
  return Array.from(layout.join("")).filter(function isMine(mark) {
    return mark === "*";
  }).length;
}

describe("MinesweeperDifficultyPreview", () => {
  const difficulties = minesweeperDifficulties.map(function toId({ id }) {
    return id;
  });

  test.each(difficulties)(
    "レベル %s の見本の地雷の割合がそのレベルの地雷密度の範囲に入ること",
    (difficulty) => {
      const layout = previewMineLayouts[difficulty];
      const { minimum, maximum } =
        minesweeperDifficultyBoardRanges[difficulty].mineDensityPercent;

      const densityPercent = (countMines(layout) * 100) / countCells(layout);

      expect(densityPercent).toBeGreaterThanOrEqual(minimum);
      expect(densityPercent).toBeLessThanOrEqual(maximum);
    },
  );

  const adjacentDifficulties = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const;

  test.each(adjacentDifficulties)(
    "レベル %s よりレベル %s の見本の盤面のマス数と地雷数が多いこと",
    (lower, higher) => {
      const lowerLayout = previewMineLayouts[lower];
      const higherLayout = previewMineLayouts[higher];

      expect(countCells(higherLayout)).toBeGreaterThan(countCells(lowerLayout));
      expect(countMines(higherLayout)).toBeGreaterThan(countMines(lowerLayout));
    },
  );

  test.each(difficulties)(
    "レベル %s の見本のマスと地雷を描くこと",
    (difficulty) => {
      const layout = previewMineLayouts[difficulty];
      const { container } = render(
        <MinesweeperDifficultyPreview difficulty={difficulty} />,
      );

      expect(container.querySelectorAll("rect")).toHaveLength(
        countCells(layout),
      );
      expect(container.querySelectorAll("circle")).toHaveLength(
        countMines(layout),
      );
    },
  );
});

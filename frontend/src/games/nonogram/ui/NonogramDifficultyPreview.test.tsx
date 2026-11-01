import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import {
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import { listNonogramPoolEntries } from "@/games/nonogram/problem/problem-pool";
import {
  _private,
  NonogramDifficultyPreview,
} from "@/games/nonogram/ui/NonogramDifficultyPreview";

const { createPreviewChain } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

const adjacentLevels = [
  ["1", "2"],
  ["2", "3"],
  ["3", "4"],
  ["4", "5"],
] as const satisfies readonly (readonly [
  NonogramDifficulty,
  NonogramDifficulty,
])[];

const ROUND_COUNT_POSITION = 5;

/** 問題集のそのレベルの連鎖の深さ（段の数）の中央値。偶数個のときは小さい側。 */
function getPoolMedianRoundCount(difficulty: NonogramDifficulty): number {
  const roundCounts = listNonogramPoolEntries(difficulty)
    .map((entry) => entry[ROUND_COUNT_POSITION])
    .sort((left, right) => left - right);
  return roundCounts[Math.floor((roundCounts.length - 1) / 2)]!;
}

afterEach(cleanup);

describe("createPreviewChain", () => {
  test.each(difficultyIds)(
    "レベル %s の盤面は、そのレベルで遊ぶ盤面の大きさのうち最も大きいものを、長い辺を横にしたものであること",
    (difficulty) => {
      const { size } = createPreviewChain(difficulty);
      const { boardSizes } = nonogramLevelCombinations[difficulty];
      const largest = boardSizes.reduce((current, candidate) =>
        candidate.width * candidate.height > current.width * current.height
          ? candidate
          : current,
      );

      expect(size).toEqual({
        width: Math.max(largest.width, largest.height),
        height: Math.min(largest.width, largest.height),
      });
    },
  );

  test.each(difficultyIds)(
    "レベル %s で読む回数は、問題集の連鎖の深さの中央値で、そのレベルの連鎖の深さの範囲に入ること",
    (difficulty) => {
      const { readings } = createPreviewChain(difficulty);
      const { roundCount } = nonogramLevelCombinations[difficulty];

      expect(readings).toHaveLength(getPoolMedianRoundCount(difficulty));
      expect(readings.length).toBeGreaterThanOrEqual(roundCount.minimum);
      expect(readings.length).toBeLessThanOrEqual(roundCount.maximum);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の連鎖は、行から始めて行と列を交互に読み、決まるマスが読んだ線と次に読む線の交わりにあること",
    (difficulty) => {
      const { readings, cells } = createPreviewChain(difficulty);

      readings.forEach((reading, readingIndex) => {
        const cell = cells[readingIndex]!;
        const nextReading = readings[readingIndex + 1];

        expect(reading.axis).toBe(readingIndex % 2 === 0 ? "row" : "column");
        expect(reading.index).toBe(
          reading.axis === "row" ? cell.row : cell.column,
        );
        if (nextReading) {
          expect(nextReading.index).toBe(
            nextReading.axis === "row" ? cell.row : cell.column,
          );
        }
      });
    },
  );

  test.each(difficultyIds)(
    "レベル %s の決まるマスは、どれも盤面の中にあって重ならないこと",
    (difficulty) => {
      const { size, cells } = createPreviewChain(difficulty);
      const cellKeys = cells.map(({ row, column }) => `${row}:${column}`);

      expect(new Set(cellKeys).size).toBe(cells.length);
      for (const { row, column } of cells) {
        expect(row).toBeLessThan(size.height);
        expect(column).toBeLessThan(size.width);
      }
    },
  );

  test.each(adjacentLevels)(
    "レベル %s よりレベル %s の盤面が、幅と高さを下げずに広いこと",
    (lowerDifficulty, higherDifficulty) => {
      const lower = createPreviewChain(lowerDifficulty).size;
      const higher = createPreviewChain(higherDifficulty).size;

      expect(higher.width).toBeGreaterThanOrEqual(lower.width);
      expect(higher.height).toBeGreaterThanOrEqual(lower.height);
      expect(higher.width * higher.height).toBeGreaterThan(
        lower.width * lower.height,
      );
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の連鎖が、レベル %s の連鎖の始めの部分と同じ読みと同じマスであること",
    (lowerDifficulty, higherDifficulty) => {
      const lower = createPreviewChain(lowerDifficulty);
      const higher = createPreviewChain(higherDifficulty);

      expect(higher.readings.length).toBeGreaterThan(lower.readings.length);
      expect(higher.readings.slice(0, lower.readings.length)).toEqual(
        lower.readings,
      );
      expect(higher.cells.slice(0, lower.cells.length)).toEqual(lower.cells);
    },
  );
});

describe("NonogramDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s の図は読み上げから外し、ヒントの数字を描かないこと",
    (difficulty) => {
      const { container } = render(
        <NonogramDifficultyPreview difficulty={difficulty} />,
      );
      const preview = container.firstElementChild;

      expect(preview?.getAttribute("aria-hidden")).toBe("true");
      expect(preview?.textContent).toBe("");
    },
  );
});

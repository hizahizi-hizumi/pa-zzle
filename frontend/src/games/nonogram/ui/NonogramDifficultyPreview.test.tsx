import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import {
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import {
  decodeNonogramPoolEntry,
  listNonogramPoolEntries,
} from "@/games/nonogram/problem/problem-pool";
import {
  _private,
  NonogramDifficultyPreview,
} from "@/games/nonogram/ui/NonogramDifficultyPreview";

const { createPreviewChain } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

/** 問題集のそのレベルの連鎖の深さ（段の数）の中央値。偶数個のときは小さい側。 */
function getPoolMedianRoundCount(difficulty: NonogramDifficulty): number {
  const roundCounts = listNonogramPoolEntries(difficulty)
    .map((entry) => decodeNonogramPoolEntry(entry).features.roundCount)
    .sort((left, right) => left - right);
  return roundCounts[Math.floor((roundCounts.length - 1) / 2)]!;
}

afterEach(cleanup);

describe("createPreviewChain", () => {
  const adjacentLevels = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const satisfies readonly (readonly [
    NonogramDifficulty,
    NonogramDifficulty,
  ])[];

  /** レベルごとの、そのレベルで遊ぶ盤面の大きさのうち面積が最も大きいもの。 */
  const largestBoardSizes = difficultyIds.map((difficulty) => {
    const { boardSizes } = nonogramLevelCombinations[difficulty];
    const largest = boardSizes.reduce((current, candidate) =>
      candidate.width * candidate.height > current.width * current.height
        ? candidate
        : current,
    );
    return [
      difficulty,
      { width: largest.width, height: largest.height },
    ] as const;
  });

  test.each(largestBoardSizes)(
    "レベル %s の盤面は、そのレベルで遊ぶ盤面の大きさのうち面積が最も大きいものを、同じ向きで描くこと",
    (difficulty, expectedSize) => {
      const { size } = createPreviewChain(difficulty);

      expect(size).toEqual(expectedSize);
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
    "レベル %s の連鎖は、行から始めて行と列を交互に読み、決まるマスが読んだ線の上にあること",
    (difficulty) => {
      const { readings, cells } = createPreviewChain(difficulty);

      readings.forEach((reading, readingIndex) => {
        const cell = cells[readingIndex]!;

        expect(reading.axis).toBe(readingIndex % 2 === 0 ? "row" : "column");
        expect(reading.index).toBe(
          reading.axis === "row" ? cell.row : cell.column,
        );
      });
    },
  );

  test.each(difficultyIds)(
    "レベル %s の連鎖は、次に読む線が、前の読みで決まったマスを通ること",
    (difficulty) => {
      const { readings, cells } = createPreviewChain(difficulty);
      const followingReadings = readings.slice(1);
      const decidedCells = cells.slice(0, -1);

      followingReadings.forEach((reading, index) => {
        const previousCell = decidedCells[index]!;

        expect(reading.index).toBe(
          reading.axis === "row" ? previousCell.row : previousCell.column,
        );
      });
    },
  );

  test.each(difficultyIds)(
    "レベル %s の決まるマスは、どれも盤面の外周のマスより内側にあって重ならないこと",
    (difficulty) => {
      const { size, cells } = createPreviewChain(difficulty);
      const cellKeys = cells.map(({ row, column }) => `${row}:${column}`);

      expect(new Set(cellKeys).size).toBe(cells.length);
      for (const { row, column } of cells) {
        expect(row).toBeGreaterThan(0);
        expect(row).toBeLessThan(size.height - 1);
        expect(column).toBeGreaterThan(0);
        expect(column).toBeLessThan(size.width - 1);
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
  describe.each(difficultyIds)("レベル %s の図", (difficulty) => {
    let preview: Element | null;

    beforeEach(() => {
      const { container } = render(
        <NonogramDifficultyPreview difficulty={difficulty} />,
      );
      preview = container.firstElementChild;
    });

    test("読み上げから外し、ヒントの数字を描かないこと", () => {
      const ariaHidden = preview?.getAttribute("aria-hidden");
      const text = preview?.textContent;

      expect(ariaHidden).toBe("true");
      expect(text).toBe("");
    });
  });
});

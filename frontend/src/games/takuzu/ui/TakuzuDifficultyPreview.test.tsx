import { cleanup, render } from "@testing-library/react";

import {
  type TakuzuDifficulty,
  takuzuDifficulties,
} from "@/games/takuzu/difficulty";
import {
  type TakuzuTechnique,
  traceTakuzuHumanSolve,
} from "@/games/takuzu/problem/generation/human-solver";
import type { TakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  TakuzuDifficultyPreview,
  takuzuDifficultyPreviewMoments,
} from "@/games/takuzu/ui/TakuzuDifficultyPreview";

afterEach(cleanup);

const difficultyIds = takuzuDifficulties.map((difficulty) => difficulty.id);

// 各難易度の分類条件を初めて満たす読み（difficulty.ts）。
const expectedTechniques = {
  "1": "adjacency",
  "2": "count-completion",
  "3": "single-remaining",
  "4": "duplicate-avoidance",
  "5": "duplicate-avoidance",
} satisfies Record<TakuzuDifficulty, TakuzuTechnique>;

function readMoment(difficulty: TakuzuDifficulty) {
  const flat = takuzuDifficultyPreviewMoments[difficulty].cells.join("");
  const givens: TakuzuBoard = {
    size: 8,
    cells: Array.from(flat, (mark) =>
      mark === "A" ? "a" : mark === "B" ? "b" : null,
    ),
  };
  const deductions = Array.from(flat).flatMap((mark, cellIndex) =>
    mark === "a" || mark === "b" ? [{ cellIndex, tile: mark }] : [],
  );
  return { givens, deductions };
}

describe("TakuzuDifficultyPreview", () => {
  test.each(difficultyIds)(
    "難易度 %s でも盤面を 8×8 で描くこと",
    (difficulty) => {
      const { container } = render(
        <TakuzuDifficultyPreview difficulty={difficulty} />,
      );

      const cells = container.firstElementChild?.children;

      expect(cells).toHaveLength(64);
    },
  );

  test.each(difficultyIds)(
    "難易度 %s で決まるマスを読む範囲の中に示すこと",
    (difficulty) => {
      const { container } = render(
        <TakuzuDifficultyPreview difficulty={difficulty} />,
      );

      const deducedCells = container.querySelectorAll("[data-deduced]");
      const outsideReadingArea = Array.from(deducedCells).filter(
        (tile) => !tile.parentElement?.hasAttribute("data-reading-area"),
      );

      expect(deducedCells.length).toBeGreaterThan(0);
      expect(outsideReadingArea).toHaveLength(0);
    },
  );

  test.each(difficultyIds)(
    "難易度 %s の局面は、その難易度を決める読みで示したマスがちょうど決まること",
    (difficulty) => {
      const { givens, deductions } = readMoment(difficulty);

      const [firstRound] = traceTakuzuHumanSolve(givens).rounds;

      expect(firstRound?.technique).toBe(expectedTechniques[difficulty]);
      expect(firstRound?.deductions).toEqual(deductions);
    },
  );

  test("難易度 5 は完成した行・列との見比べを難易度 4 より多くの場所で要すること", () => {
    const sourceCounts = (["4", "5"] as const).map(
      (difficulty) =>
        traceTakuzuHumanSolve(readMoment(difficulty).givens).rounds[0]
          ?.sourceCount,
    );

    expect(sourceCounts).toEqual([1, 2]);
  });
});

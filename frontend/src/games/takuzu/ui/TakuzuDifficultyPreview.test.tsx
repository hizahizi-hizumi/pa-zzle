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

// 各難易度で初めて要る読み。難易度5 はこの読み（D）が2つの局面で要ることで決まるが、図では2か所の見比べを1つの局面にまとめて描く。
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
  describe.each(difficultyIds)("難易度 %s の場合", (difficulty) => {
    let preview: Element | null;

    beforeEach(() => {
      const { container } = render(
        <TakuzuDifficultyPreview difficulty={difficulty} />,
      );
      preview = container.firstElementChild;
    });

    test("盤面を 8×8 で描くこと", () => {
      const cells = preview?.children;

      expect(cells).toHaveLength(64);
    });

    test("決まるマスを読む範囲の中に示すこと", () => {
      const deducedCells = Array.from(
        preview?.querySelectorAll("[data-deduced]") ?? [],
      );
      const outsideReadingArea = deducedCells.filter(
        (tile) => !tile.parentElement?.hasAttribute("data-reading-area"),
      );

      expect(deducedCells.length).toBeGreaterThan(0);
      expect(outsideReadingArea).toHaveLength(0);
    });
  });

  describe("takuzuDifficultyPreviewMoments", () => {
    const momentCases = difficultyIds.map(
      (difficulty) => [difficulty, readMoment(difficulty)] as const,
    );
    const duplicateAvoidanceGivens = [
      readMoment("4").givens,
      readMoment("5").givens,
    ];

    test.each(momentCases)(
      "難易度 %s の局面は、人間向け解法器の最初のラウンドがその難易度で初めて要る読みになり、示したマスがちょうど決まること",
      (difficulty, { givens, deductions }) => {
        const [firstRound] = traceTakuzuHumanSolve(givens).rounds;

        expect(firstRound?.technique).toBe(expectedTechniques[difficulty]);
        expect(firstRound?.deductions).toEqual(deductions);
      },
    );

    test("難易度 5 の局面は完成した行・列との見比べを難易度 4 より多くの場所で要すること", () => {
      const sourceCounts = duplicateAvoidanceGivens.map(
        (givens) => traceTakuzuHumanSolve(givens).rounds[0]?.sourceCount,
      );

      expect(sourceCounts).toEqual([1, 2]);
    });
  });
});

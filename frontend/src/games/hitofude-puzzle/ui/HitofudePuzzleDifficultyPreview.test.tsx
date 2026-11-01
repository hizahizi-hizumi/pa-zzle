import { cleanup, render, waitFor } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import { selectHitofudePuzzlePreviewProblem } from "@/games/hitofude-puzzle/problem-selection";
import { listHitofudePuzzleOpenCells } from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleDifficultyPreview } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview";
import { placeHitofudePuzzleThinkingMarks } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview/thinking-marks";

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

describe("HitofudePuzzleDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では、そのレベルの代表の問題の盤面を道を引かずに描き、考えどころの数だけ「?」を重ねること",
    async (difficulty) => {
      const board = selectHitofudePuzzlePreviewProblem(difficulty);
      const { container } = render(
        <HitofudePuzzleDifficultyPreview difficulty={difficulty} />,
      );

      const [figure] = container.querySelectorAll("svg");
      expect(figure?.getAttribute("viewBox")).toBe(
        `0 0 ${board.size} ${board.size}`,
      );
      expect(figure?.querySelectorAll(":scope > rect")).toHaveLength(
        listHitofudePuzzleOpenCells(board).length,
      );
      expect(figure?.querySelectorAll(":scope > line")).toHaveLength(0);
      const expectedMarks = placeHitofudePuzzleThinkingMarks(board).length;
      await waitFor(() =>
        expect(container.querySelectorAll("text")).toHaveLength(expectedMarks),
      );
      for (const mark of container.querySelectorAll("text")) {
        expect(mark.textContent).toBe("?");
      }
    },
  );
});

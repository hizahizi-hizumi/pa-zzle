import { cleanup, render } from "@testing-library/react";
import { difficultyLevels } from "@/games/difficulty";

import { selectHitofudePuzzlePreviewProblem } from "@/games/hitofude-puzzle/problem-selection";
import { listHitofudePuzzleOpenCells } from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleDifficultyPreview } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview";

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

describe("HitofudePuzzleDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では、そのレベルの代表の問題の盤面を、全マスを描いて道を引かずに描くこと",
    (difficulty) => {
      const board = selectHitofudePuzzlePreviewProblem(difficulty);
      const { container } = render(
        <HitofudePuzzleDifficultyPreview difficulty={difficulty} />,
      );

      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe(
        `0 0 ${board.size} ${board.size}`,
      );
      expect(container.querySelectorAll("svg > rect")).toHaveLength(
        listHitofudePuzzleOpenCells(board).length,
      );
      expect(container.querySelectorAll("svg > line")).toHaveLength(0);
    },
  );
});

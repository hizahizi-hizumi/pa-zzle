import { cleanup, render, screen } from "@testing-library/react";

import {
  type SlidePuzzleDifficulty,
  slidePuzzleDifficulties,
  slidePuzzleDifficultyCriteria,
} from "@/games/slide-puzzle/difficulty";
import { SlidePuzzleDifficultyPreview } from "@/games/slide-puzzle/ui/SlidePuzzleDifficultyPreview";

afterEach(cleanup);

describe("SlidePuzzleDifficultyPreview", () => {
  const cases = slidePuzzleDifficulties.map(
    ({ id }) =>
      [
        id,
        slidePuzzleDifficultyCriteria[id].boardSize,
      ] as const satisfies readonly [SlidePuzzleDifficulty, number],
  );

  describe.each(cases)("レベル %s の場合", (difficulty, boardSize) => {
    beforeEach(() => {
      render(<SlidePuzzleDifficultyPreview difficulty={difficulty} />);
    });

    test("そのレベルで実際に遊ぶ盤面サイズのタイルを並べること", () => {
      const tiles = screen.getAllByText(/^\d+$/);

      expect(tiles).toHaveLength(boardSize * boardSize - 1);
    });
  });
});

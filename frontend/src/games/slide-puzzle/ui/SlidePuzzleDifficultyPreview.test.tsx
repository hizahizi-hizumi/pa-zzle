import { cleanup, render, screen } from "@testing-library/react";

import {
  type SlidePuzzleDifficulty,
  slidePuzzleDifficultyCriteria,
} from "@/games/slide-puzzle/difficulty";
import { SlidePuzzleDifficultyPreview } from "@/games/slide-puzzle/ui/SlidePuzzleDifficultyPreview";

afterEach(cleanup);

function readPreviewRows(columnCount: number): number[][] {
  const tiles = screen
    .getAllByText(/^\d+$/)
    .map((tile) => Number(tile.textContent));
  return [tiles.slice(0, columnCount), tiles.slice(columnCount)];
}

function listTilesInSolvedPosition(
  row: readonly number[],
  rowIndex: number,
): number[] {
  const columnCount = row.length;
  return row.filter(
    (tile, columnIndex) => tile === rowIndex * columnCount + columnIndex + 1,
  );
}

describe("SlidePuzzleDifficultyPreview", () => {
  const cases = [
    ["1", "崩した行"],
    ["2", "揃えた行"],
    ["3", "崩した行"],
    ["4", "揃えた行"],
    ["5", "崩した行"],
  ] as const satisfies readonly (readonly [
    SlidePuzzleDifficulty,
    "揃えた行" | "崩した行",
  ])[];

  describe.each(cases)("レベル %s の場合", (difficulty, firstRowKind) => {
    const columnCount = slidePuzzleDifficultyCriteria[difficulty].boardSize;

    beforeEach(() => {
      render(<SlidePuzzleDifficultyPreview difficulty={difficulty} />);
    });

    test("そのレベルで遊ぶ盤面の幅で、空きマスを含まない2行ぶんのタイルを並べること", () => {
      const rows = readPreviewRows(columnCount);

      expect(rows.map((row) => row.length)).toEqual([columnCount, columnCount]);
    });

    test("2行目に正しい位置のタイルを置かないこと", () => {
      const [, secondRow = []] = readPreviewRows(columnCount);
      const tilesInSolvedPosition = listTilesInSolvedPosition(secondRow, 1);

      expect(tilesInSolvedPosition).toEqual([]);
    });

    test(`1行目を${firstRowKind}として描くこと`, () => {
      const [firstRow = []] = readPreviewRows(columnCount);
      const tilesInSolvedPosition = listTilesInSolvedPosition(firstRow, 0);

      expect(tilesInSolvedPosition).toHaveLength(
        firstRowKind === "揃えた行" ? columnCount : 0,
      );
    });
  });
});

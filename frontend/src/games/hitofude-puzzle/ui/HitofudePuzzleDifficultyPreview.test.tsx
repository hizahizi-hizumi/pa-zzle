import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  isHitofudePuzzleHole,
  listHitofudePuzzleGridNeighbors,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  _private,
  HitofudePuzzleDifficultyPreview,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview";

const { PREVIEW_ROW_COUNT, createPreviewBoard } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

function isStripCell(board: HitofudePuzzleBoard, cell: number): boolean {
  return (
    getHitofudePuzzleCellPosition(board.size, cell).row < PREVIEW_ROW_COUNT
  );
}

function isOpenStripCell(board: HitofudePuzzleBoard, cell: number): boolean {
  return isStripCell(board, cell) && !isHitofudePuzzleHole(board, cell);
}

/** 四方が帯の中の通れるマスに囲まれた、盤面に開いた穴。 */
function listInnerHoles(board: HitofudePuzzleBoard): number[] {
  return board.holes.filter((hole) => {
    const neighbors = listHitofudePuzzleGridNeighbors(board.size, hole);
    return (
      isStripCell(board, hole) &&
      neighbors.length === 4 &&
      neighbors.every((cell) => isOpenStripCell(board, cell))
    );
  });
}

/** 4マスとも通れる 2×2 の数。 */
function countOpenSquares(board: HitofudePuzzleBoard): number {
  let count = 0;
  for (let row = 0; row + 1 < PREVIEW_ROW_COUNT; row++) {
    for (let column = 0; column + 1 < board.size; column++) {
      const topLeft = row * board.size + column;
      const square = [
        topLeft,
        topLeft + 1,
        topLeft + board.size,
        topLeft + board.size + 1,
      ];
      if (square.every((cell) => isOpenStripCell(board, cell))) {
        count += 1;
      }
    }
  }
  return count;
}

function pairAdjacentLevels(values: readonly number[]): [number, number][] {
  return values
    .slice(1)
    .map((value, index) => [values[index]!, value] as [number, number]);
}

describe("createPreviewBoard", () => {
  describe.each(difficultyIds)("レベル %s の場合", (difficulty) => {
    const board = createPreviewBoard(difficulty);

    test("穴以外の全マスを1回ずつ通る道がちょうど1本あること", () => {
      const result = countHitofudePuzzleSolutions(board, { solutionLimit: 2 });

      expect(result.status).toBe("complete");
      expect(result.solutionCount).toBe(1);
    });

    test("帯の下の行をすべて穴にすること", () => {
      const openCells = listHitofudePuzzleOpenCells(board);

      expect(openCells.every((cell) => isStripCell(board, cell))).toBe(true);
    });

    test("内側の穴を1〜2個持つこと", () => {
      const innerHoles = listInnerHoles(board);

      expect(innerHoles.length).toBeGreaterThanOrEqual(1);
      expect(innerHoles.length).toBeLessThanOrEqual(2);
    });
  });

  describe("レベルを並べた場合", () => {
    const boards = difficultyIds.map((difficulty) =>
      createPreviewBoard(difficulty),
    );

    test("上のレベルほど帯の列が多いこと", () => {
      const pairs = pairAdjacentLevels(boards.map(({ size }) => size));

      for (const [lower, upper] of pairs) {
        expect(upper).toBeGreaterThan(lower);
      }
    });

    test("上のレベルほど、4マスとも通れる 2×2 が多いこと", () => {
      const pairs = pairAdjacentLevels(boards.map(countOpenSquares));

      for (const [lower, upper] of pairs) {
        expect(upper).toBeGreaterThan(lower);
      }
    });
  });
});

describe("HitofudePuzzleDifficultyPreview", () => {
  describe.each(difficultyIds)("レベル %s の場合", (difficulty) => {
    const board = createPreviewBoard(difficulty);

    test("帯の盤面のマスと始点だけを描き、道を引かないこと", () => {
      const { container } = render(
        <HitofudePuzzleDifficultyPreview difficulty={difficulty} />,
      );
      const figure = container.querySelector("svg");

      expect(figure?.getAttribute("viewBox")).toBe(
        `0 0 ${board.size} ${PREVIEW_ROW_COUNT}`,
      );
      expect(figure?.querySelectorAll(":scope > rect")).toHaveLength(
        listHitofudePuzzleOpenCells(board).length,
      );
      expect(figure?.querySelectorAll(":scope > line")).toHaveLength(0);
    });
  });
});

import { cleanup, render } from "@testing-library/react";
import { difficultyLevels } from "@/games/difficulty";

import {
  type HamiltonianPathDifficulty,
  hamiltonianPathLevelCombinations,
} from "@/games/hamiltonian-path/difficulty";
import {
  areHamiltonianPathCellsAdjacent,
  getHamiltonianPathCellPosition,
  listHamiltonianPathOpenCells,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  findHamiltonianPathStranding,
  isHamiltonianPathDeadEnd,
  isHamiltonianPathSolved,
} from "@/games/hamiltonian-path/puzzle/rules";
import {
  _private,
  HamiltonianPathDifficultyPreview,
} from "@/games/hamiltonian-path/ui/HamiltonianPathDifficultyPreview";

const { previewStrip, createPreviewStrip } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

function readStrip(difficulty: HamiltonianPathDifficulty) {
  const strip = createPreviewStrip(difficulty);
  const { board, path } = strip;
  function toStripCell(cell: number) {
    const { row, column } = getHamiltonianPathCellPosition(board.size, cell);
    return `${row}:${column}`;
  }
  const openCells = listHamiltonianPathOpenCells(board);
  return {
    ...strip,
    openCells,
    /** 帯の中の位置（行・列）で表した道。盤面の幅が変わっても同じマスとして比べる。 */
    stripPath: path.map(toStripCell),
    stripCells: openCells.map(toStripCell),
    undecidedCellCount: openCells.length - path.length,
  };
}

describe("createPreviewStrip", () => {
  const adjacentLevels = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const satisfies readonly (readonly [
    HamiltonianPathDifficulty,
    HamiltonianPathDifficulty,
  ])[];

  test.each(difficultyIds)(
    "レベル %s の帯は、そのレベルで遊ぶ盤面サイズの上限の幅で、帯の行だけを有効マスにすること",
    (difficulty) => {
      const { board, openCells } = readStrip(difficulty);

      expect(board.size).toBe(
        hamiltonianPathLevelCombinations[difficulty].boardSize.maximum,
      );
      expect(openCells).toHaveLength(board.size * previewStrip.rowCount);
      expect(
        openCells.every(
          (cell) =>
            getHamiltonianPathCellPosition(board.size, cell).row <
            previewStrip.rowCount,
        ),
      ).toBe(true);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の道は、始点から隣り合う有効マスを1回ずつ通ること",
    (difficulty) => {
      const { board, path, openCells } = readStrip(difficulty);
      const open = new Set(openCells);

      expect(path[0]).toBe(board.start);
      expect(new Set(path).size).toBe(path.length);
      expect(path.every((cell) => open.has(cell))).toBe(true);
      expect(
        path
          .slice(1)
          .every((cell, index) =>
            areHamiltonianPathCellsAdjacent(board.size, path[index]!, cell),
          ),
      ).toBe(true);
    },
  );

  test("局所の推論だけで決まるレベル1 では、帯の全マスを通り終えること", () => {
    const { board, path } = readStrip("1");

    expect(isHamiltonianPathSolved(board, path)).toBe(true);
  });

  test.each(difficultyIds.filter((difficulty) => difficulty !== "1"))(
    "先読みの要るレベル %s では、残りのマスを空けたまま、行き止まりにも取り残しにもならない所で止めること",
    (difficulty) => {
      const { board, path, undecidedCellCount } = readStrip(difficulty);

      expect(undecidedCellCount).toBeGreaterThan(0);
      expect(isHamiltonianPathDeadEnd(board, path)).toBe(false);
      expect(findHamiltonianPathStranding(board, path)).toBeNull();
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の帯を、レベル %s の帯が同じ位置に含み、引いた道は下のレベルの道の先頭の部分で、空けたマスを増やすこと",
    (lower, upper) => {
      const lowerStrip = readStrip(lower);
      const upperStrip = readStrip(upper);

      expect(upperStrip.stripCells).toEqual(
        expect.arrayContaining(lowerStrip.stripCells),
      );
      expect(
        lowerStrip.stripPath.slice(0, upperStrip.stripPath.length),
      ).toEqual(upperStrip.stripPath);
      expect(upperStrip.undecidedCellCount).toBeGreaterThan(
        lowerStrip.undecidedCellCount,
      );
    },
  );
});

describe("HamiltonianPathDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では、帯の行のマスだけを描き、穴を描かないこと",
    (difficulty) => {
      const { board } = createPreviewStrip(difficulty);
      const { container } = render(
        <HamiltonianPathDifficultyPreview difficulty={difficulty} />,
      );

      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe(
        `0 0 ${board.size} ${previewStrip.rowCount}`,
      );
      expect(container.querySelectorAll("svg > rect")).toHaveLength(
        board.size * previewStrip.rowCount,
      );
    },
  );
});

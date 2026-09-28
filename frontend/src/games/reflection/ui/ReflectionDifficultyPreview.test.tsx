import { cleanup, render } from "@testing-library/react";

import {
  type ReflectionDifficulty,
  reflectionDifficulties,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import {
  countReflectionBoardPieces,
  getReflectionCellPosition,
  getReflectionInventoryPieceCount,
} from "@/games/reflection/puzzle/board";
import {
  _private,
  ReflectionDifficultyPreview,
} from "@/games/reflection/ui/ReflectionDifficultyPreview";

const { previewStrip, createPreviewStrip } = _private;

const difficultyIds = reflectionDifficulties.map(({ id }) => id);

afterEach(cleanup);

function readStrip(difficulty: ReflectionDifficulty) {
  const strip = createPreviewStrip(difficulty);
  const { board, firstRow, trace } = strip;
  function toStripCell(cellIndex: number) {
    const { row, column } = getReflectionCellPosition(board.size, cellIndex);
    return { row: row - firstRow, column };
  }
  /** 帯の中の位置（帯の行・列）ごとのピース。盤面の大きさが変わっても同じマスとして比べる。 */
  const piecesByStripCell = Object.fromEntries(
    board.cells.flatMap(function toEntry(cell, cellIndex) {
      if (cell === null) return [];
      const { row, column } = toStripCell(cellIndex);
      return [[`${row}:${column}`, cell] as const];
    }),
  );
  /** 光が通るマスを、帯の中の位置として順に並べたもの。 */
  const stripPath = trace.path.map(({ cellIndex }) => {
    const { row, column } = toStripCell(cellIndex);
    return `${row}:${column}`;
  });
  const turnCount = trace.path.filter(
    (step) => step.leaving !== step.entering,
  ).length;
  const pieceCount = getReflectionInventoryPieceCount(
    countReflectionBoardPieces(board),
  );
  return { ...strip, pieceCount, piecesByStripCell, stripPath, turnCount };
}

describe("createPreviewStrip", () => {
  const adjacentLevels = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const satisfies readonly (readonly [
    ReflectionDifficulty,
    ReflectionDifficulty,
  ])[];

  test.each(difficultyIds)(
    "レベル %s の帯は、そのレベルで遊ぶ盤面サイズの上限の幅で、ピース数の範囲に入るピースを置くこと",
    (difficulty) => {
      const { board, pieceCount } = readStrip(difficulty);
      const combination = reflectionLevelCombinations[difficulty];

      expect(board.size).toBe(combination.boardSize.maximum);
      expect(pieceCount).toBeGreaterThanOrEqual(combination.pieceCount.minimum);
      expect(pieceCount).toBeLessThanOrEqual(combination.pieceCount.maximum);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の光は、帯の中だけを通ってレベルの数の2倍折れ、右の外周から出ること",
    (difficulty) => {
      const { trace, stripPath, turnCount } = readStrip(difficulty);

      expect(turnCount).toBe(Number(difficulty) * 2);
      expect(
        stripPath.every((cell) => {
          const row = Number(cell.split(":")[0]);
          return row >= 0 && row < previewStrip.rowCount;
        }),
      ).toBe(true);
      expect(trace.outcome).toBe("exit");
      expect(trace.exit?.side).toBe("right");
    },
  );

  test.each(difficultyIds)(
    "レベル %s のピースには、どれも光が当たること",
    (difficulty) => {
      const { board, trace } = readStrip(difficulty);
      const litCells = new Set(trace.path.map(({ cellIndex }) => cellIndex));

      expect(
        board.cells.every(
          (cell, cellIndex) => cell === null || litCells.has(cellIndex),
        ),
      ).toBe(true);
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の帯のピースを、レベル %s の帯がすべて同じ位置に含み、盤面を狭めずに光路をその先へ延ばすこと",
    (lower, upper) => {
      const lowerStrip = readStrip(lower);
      const upperStrip = readStrip(upper);

      expect(upperStrip.board.size).toBeGreaterThanOrEqual(
        lowerStrip.board.size,
      );
      expect(upperStrip.piecesByStripCell).toMatchObject(
        lowerStrip.piecesByStripCell,
      );
      expect(Object.keys(upperStrip.piecesByStripCell).length).toBeGreaterThan(
        Object.keys(lowerStrip.piecesByStripCell).length,
      );
      expect(upperStrip.turnCount).toBeGreaterThan(lowerStrip.turnCount);
      // 下のレベルで最後に折れたマスまでは、上のレベルでも同じ道筋を通る。
      const lowerLastTurn = lowerStrip.trace.path.findLastIndex(
        (step) => step.leaving !== step.entering,
      );
      expect(upperStrip.stripPath.slice(0, lowerLastTurn + 1)).toEqual(
        lowerStrip.stripPath.slice(0, lowerLastTurn + 1),
      );
    },
  );
});

describe("ReflectionDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では光の線を1本だけ描き、外周ヒントの数字を描かないこと",
    (difficulty) => {
      const { container } = render(
        <ReflectionDifficultyPreview difficulty={difficulty} />,
      );

      expect(container.querySelectorAll("[data-laser-line]")).toHaveLength(1);
      expect(container.querySelectorAll("text")).toHaveLength(0);
    },
  );
});

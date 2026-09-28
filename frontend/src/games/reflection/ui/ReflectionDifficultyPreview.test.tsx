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
  isSameReflectionEntry,
  type ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import {
  _private,
  ReflectionDifficultyPreview,
} from "@/games/reflection/ui/ReflectionDifficultyPreview";

const { previewStrip, createPreviewStrip } = _private;

const difficultyIds = reflectionDifficulties.map(({ id }) => id);
const STRIP_ROW_COUNT = previewStrip.pieces.length;

afterEach(cleanup);

function readStrip(difficulty: ReflectionDifficulty) {
  const strip = createPreviewStrip(difficulty);
  const { board, firstRow } = strip;
  const pieceCount = getReflectionInventoryPieceCount(
    countReflectionBoardPieces(board),
  );
  /** 帯の中の位置（帯の行・列）ごとのピース。盤面の大きさが変わっても同じマスとして比べる。 */
  const piecesByStripCell = new Map(
    board.cells.flatMap(function toStripCell(cell, cellIndex) {
      if (cell === null) return [];
      const { row, column } = getReflectionCellPosition(board.size, cellIndex);
      return [[`${row - firstRow}:${column}`, cell] as const];
    }),
  );
  return { ...strip, pieceCount, piecesByStripCell };
}

/** 帯の中の位置として読んだ光路の入口。 */
function toStripEntry(
  { entry }: { entry: ReflectionEntry },
  firstRow: number,
): string {
  return `${entry.side}:${entry.index - firstRow}`;
}

function isInStrip(size: number, firstRow: number, cellIndex: number) {
  const { row } = getReflectionCellPosition(size, cellIndex);
  return firstRow <= row && row < firstRow + STRIP_ROW_COUNT;
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
    "レベル %s の帯は、推論レベルと同じ本数の光路を点けること",
    (difficulty) => {
      const { lights } = readStrip(difficulty);

      expect(lights).toHaveLength(
        reflectionLevelCombinations[difficulty].reasoningLevel,
      );
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の帯のピースと点いた光路の入口を、レベル %s の帯がすべて同じ位置に含み、盤面を狭めずピースと光路を増やすこと",
    (lower, upper) => {
      const lowerStrip = readStrip(lower);
      const upperStrip = readStrip(upper);

      expect(upperStrip.board.size).toBeGreaterThanOrEqual(
        lowerStrip.board.size,
      );
      expect(upperStrip.pieceCount).toBeGreaterThan(lowerStrip.pieceCount);
      expect(upperStrip.lights.length).toBeGreaterThan(
        lowerStrip.lights.length,
      );
      expect(Object.fromEntries(upperStrip.piecesByStripCell)).toMatchObject(
        Object.fromEntries(lowerStrip.piecesByStripCell),
      );
      expect(
        upperStrip.lights.map((light) =>
          toStripEntry(light, upperStrip.firstRow),
        ),
      ).toEqual(
        expect.arrayContaining(
          lowerStrip.lights.map((light) =>
            toStripEntry(light, lowerStrip.firstRow),
          ),
        ),
      );
    },
  );

  describe.each(difficultyIds)("レベル %s の点いた光路", (difficulty) => {
    const { board, firstRow, lights } = readStrip(difficulty);

    test("帯の中だけを通り、左右の外周から出るか吸収されること", () => {
      const leavesStrip = lights.some(
        ({ trace }) =>
          trace.path.some(
            ({ cellIndex }) => !isInStrip(board.size, firstRow, cellIndex),
          ) ||
          (trace.exit !== null &&
            (trace.exit.side === "top" || trace.exit.side === "bottom")),
      );

      expect(leavesStrip).toBe(false);
    });

    test("どれもピースに当たり、帯のピースすべてにどれかが当たること", () => {
      const touchedCellIndices = lights.map(
        ({ trace }) =>
          new Set(
            trace.path
              .map(({ cellIndex }) => cellIndex)
              .filter((cellIndex) => board.cells[cellIndex] !== null),
          ),
      );
      const pieceCellIndices = board.cells.flatMap((cell, cellIndex) =>
        cell === null ? [] : [cellIndex],
      );

      expect(touchedCellIndices.every((cells) => cells.size > 0)).toBe(true);
      expect(
        pieceCellIndices.every((cellIndex) =>
          touchedCellIndices.some((cells) => cells.has(cellIndex)),
        ),
      ).toBe(true);
    });

    test("別々の光路で、同じ光路の両端を2本と数えないこと", () => {
      const endsOfOtherLights = lights.flatMap(({ trace }, index) =>
        trace.outcome === "exit" && trace.exit
          ? [{ exit: trace.exit, index }]
          : [],
      );

      const counted = lights.some(({ entry }, index) =>
        endsOfOtherLights.some(
          (end) =>
            end.index !== index && isSameReflectionEntry(end.exit, entry),
        ),
      );

      expect(counted).toBe(false);
    });

    test("同じマスを通る光路どうしでつながり、照らし合わせて読む1つのまとまりになること", () => {
      const cellSets = lights.map(
        ({ trace }) => new Set(trace.path.map(({ cellIndex }) => cellIndex)),
      );
      const connected = new Set([0]);
      let grown = true;
      while (grown) {
        grown = false;
        cellSets.forEach((cells, index) => {
          if (connected.has(index)) return;
          const meets = [...connected].some((other) =>
            [...cells].some((cellIndex) => cellSets[other]?.has(cellIndex)),
          );
          if (meets) {
            connected.add(index);
            grown = true;
          }
        });
      }

      expect(connected.size).toBe(lights.length);
    });
  });

  test("最上位のレベルでは、退出・反射・吸収のすべての結末を見せること", () => {
    const { lights } = readStrip("5");

    const outcomes = new Set(lights.map(({ trace }) => trace.outcome));

    expect([...outcomes].sort()).toEqual(["absorb", "exit", "reflect"]);
  });
});

describe("ReflectionDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では点いた光路の数だけ光の線を描くこと",
    (difficulty) => {
      const { container } = render(
        <ReflectionDifficultyPreview difficulty={difficulty} />,
      );

      const lines = container.querySelectorAll("[data-laser-line]");

      expect(lines).toHaveLength(Number(difficulty));
    },
  );
});

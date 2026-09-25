/** 盤面に置く2種類のタイル。数字の 0 / 1 ではなく、見た目の異なる2種類として扱う。 */
export type TakuzuTile = "a" | "b";

/** `null` はまだ何も置かれていない空きマス。 */
export type TakuzuCell = TakuzuTile | null;

/** 一辺 `size` の正方形盤面。`cells` は行優先で並べる。 */
export type TakuzuBoard = {
  size: number;
  cells: readonly TakuzuCell[];
};

export type TakuzuLine = {
  axis: "row" | "column";
  index: number;
};

const cellByNotation = {
  A: "a",
  B: "b",
  ".": null,
} as const satisfies Record<string, TakuzuCell>;

type TakuzuCellNotation = keyof typeof cellByNotation;

function isTakuzuCellNotation(value: string): value is TakuzuCellNotation {
  return Object.hasOwn(cellByNotation, value);
}

export function assertTakuzuBoard(board: TakuzuBoard): void {
  if (!Number.isInteger(board.size) || board.size < 2 || board.size % 2 !== 0) {
    throw new RangeError("Takuzu board size must be a positive even integer");
  }

  if (board.cells.length !== board.size * board.size) {
    throw new RangeError("Takuzu board cells must fill a square board");
  }
}

/**
 * 1行を1文字列とした記法から盤面を作る。`A` と `B` がタイル、`.` が空きマス。
 * 固定問題やテストで盤面を読みやすく書くための記法。
 */
export function parseTakuzuBoard(rows: readonly string[]): TakuzuBoard {
  const isSquare = rows.every((row) => row.length === rows.length);
  if (!isSquare) {
    throw new RangeError("Takuzu board rows must match the board size");
  }

  const cells = rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isTakuzuCellNotation(notation)) {
        throw new RangeError(`Unknown Takuzu cell notation: ${notation}`);
      }
      return cellByNotation[notation];
    });
  });
  const board = { size: rows.length, cells };
  assertTakuzuBoard(board);
  return board;
}

export function getTakuzuCellPosition(
  size: number,
  cellIndex: number,
): { row: number; column: number } {
  return { row: Math.floor(cellIndex / size), column: cellIndex % size };
}

export function listTakuzuLines(size: number): TakuzuLine[] {
  return (["row", "column"] as const).flatMap(function listAxisLines(axis) {
    return Array.from({ length: size }, function createLine(_, index) {
      return { axis, index };
    });
  });
}

export function getTakuzuLineCellIndices(
  size: number,
  line: TakuzuLine,
): number[] {
  return Array.from({ length: size }, function getCellIndex(_, position) {
    return line.axis === "row"
      ? line.index * size + position
      : position * size + line.index;
  });
}

export function getTakuzuLineCells(
  board: TakuzuBoard,
  line: TakuzuLine,
): TakuzuCell[] {
  return getTakuzuLineCellIndices(board.size, line).map(
    function getCell(cellIndex) {
      return board.cells[cellIndex] ?? null;
    },
  );
}

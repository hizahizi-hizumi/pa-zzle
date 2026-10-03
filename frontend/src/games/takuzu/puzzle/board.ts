/** 盤面に置く2種類のタイル。数字の 0 / 1 ではなく、見た目の異なる2種類として扱う。 */
export type TakuzuTile = "a" | "b";

/** `null` はまだ何も置かれていない空きマス。 */
export type TakuzuCell = TakuzuTile | null;

/** 一辺 `size` の正方形盤面。`cells` は行優先で並べる。 */
export type TakuzuBoard = {
  size: number;
  cells: readonly TakuzuCell[];
};

/**
 * マスの並びの行数と列数。本番の盤面は正方形だが、チュートリアルでは1行だけの盤面も使う。
 */
export type TakuzuGridShape = {
  rowCount: number;
  columnCount: number;
};

/** 形と、行優先で並べたマス。正方形に限らない盤面をルールで判定するときに使う。 */
export type TakuzuGrid = {
  shape: TakuzuGridShape;
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

function parseTakuzuCells(rows: readonly string[]): TakuzuCell[] {
  return rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isTakuzuCellNotation(notation)) {
        throw new RangeError(`Unknown Takuzu cell notation: ${notation}`);
      }
      return cellByNotation[notation];
    });
  });
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

  const board = { size: rows.length, cells: parseTakuzuCells(rows) };
  assertTakuzuBoard(board);
  return board;
}

/** `parseTakuzuBoard` と同じ記法から、正方形に限らないマスの並びを作る。 */
export function parseTakuzuGrid(rows: readonly string[]): TakuzuGrid {
  const columnCount = rows[0]?.length ?? 0;
  if (columnCount === 0 || rows.some((row) => row.length !== columnCount)) {
    throw new RangeError("Takuzu grid rows must share a non-zero length");
  }

  return {
    shape: { rowCount: rows.length, columnCount },
    cells: parseTakuzuCells(rows),
  };
}

export function getTakuzuSquareShape(size: number): TakuzuGridShape {
  return { rowCount: size, columnCount: size };
}

export function getTakuzuCellPosition(
  columnCount: number,
  cellIndex: number,
): { row: number; column: number } {
  return {
    row: Math.floor(cellIndex / columnCount),
    column: cellIndex % columnCount,
  };
}

function getTakuzuLineLength(
  { rowCount, columnCount }: TakuzuGridShape,
  axis: TakuzuLine["axis"],
): number {
  return axis === "row" ? columnCount : rowCount;
}

/**
 * ルールを当てはめる行・列。1マスしかない並びは行・列として扱わない。
 * 1行だけの盤面では、縦の1マスずつを列とみなすと同じ数・同じ並びのルールが成り立たないため。
 */
export function listTakuzuGridLines(shape: TakuzuGridShape): TakuzuLine[] {
  return (["row", "column"] as const).flatMap(function listAxisLines(axis) {
    if (getTakuzuLineLength(shape, axis) < 2) {
      return [];
    }
    const lineCount = axis === "row" ? shape.rowCount : shape.columnCount;
    return Array.from({ length: lineCount }, function createLine(_, index) {
      return { axis, index };
    });
  });
}

export function listTakuzuLines(size: number): TakuzuLine[] {
  return listTakuzuGridLines(getTakuzuSquareShape(size));
}

export function getTakuzuGridLineCellIndices(
  shape: TakuzuGridShape,
  line: TakuzuLine,
): number[] {
  return Array.from(
    { length: getTakuzuLineLength(shape, line.axis) },
    function getCellIndex(_, position) {
      return line.axis === "row"
        ? line.index * shape.columnCount + position
        : position * shape.columnCount + line.index;
    },
  );
}

export function getTakuzuLineCellIndices(
  size: number,
  line: TakuzuLine,
): number[] {
  return getTakuzuGridLineCellIndices(getTakuzuSquareShape(size), line);
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

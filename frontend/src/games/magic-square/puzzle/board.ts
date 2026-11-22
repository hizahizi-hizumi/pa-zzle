/** マスの数。`null` は空きマス。 */
export type MagicSquareCell = number | null;

/** 一辺 `size` の正方形の盤面。`cells` は行優先で並べ、マスの番号は `row * size + column`。 */
export type MagicSquareBoard = {
  size: number;
  cells: readonly MagicSquareCell[];
};

/**
 * 合計をそろえる列。行は上から、縦の列は左から数える。
 * 斜めは、左上から右下へ下る `top-left` と、右上から左下へ下る `top-right` の2本。
 */
export type MagicSquareLine =
  | { kind: "row"; index: number }
  | { kind: "column"; index: number }
  | { kind: "diagonal"; from: "top-left" | "top-right" };

export type MagicSquareCellPosition = { row: number; column: number };

/** 置ける数の最大。1 から `size × size` までを1回ずつ使う。 */
export function getMagicSquareMaxValue(size: number): number {
  return size * size;
}

/** どの列もそろえる合計。1〜n² の総和を n 本の行で等分した値。 */
export function getMagicSquareMagicSum(size: number): number {
  return (size * (size * size + 1)) / 2;
}

export function isMagicSquareValue(size: number, value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= getMagicSquareMaxValue(size)
  );
}

export function isMagicSquareCellIndex(
  size: number,
  cellIndex: number,
): boolean {
  return (
    Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < size * size
  );
}

/** 盤面の形と、どの数も 1〜n² の範囲で1回までしか置かれていないことを確かめる。 */
export function assertMagicSquareBoard(board: MagicSquareBoard): void {
  const { size, cells } = board;
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Magic square board size must be a positive integer");
  }
  if (cells.length !== size * size) {
    throw new RangeError("Magic square board cells must fill a square board");
  }

  const placedValues = cells.filter((cell) => cell !== null);
  if (!placedValues.every((value) => isMagicSquareValue(size, value))) {
    throw new RangeError(
      `Magic square board values must be from 1 to ${getMagicSquareMaxValue(size)}`,
    );
  }
  if (new Set(placedValues).size !== placedValues.length) {
    throw new RangeError("Magic square board must not repeat a value");
  }
}

/**
 * 固定問題やテストで盤面を読みやすく書くための記法。1行を、空白で区切った数と空きマスの `.` で書く。
 * 例: `["16 . . 13", ". 10 11 .", "9 . . 12", ". 15 14 1"]`
 */
export function parseMagicSquareBoard(
  rows: readonly string[],
): MagicSquareBoard {
  const size = rows.length;
  const cells = rows.flatMap(function parseRow(row) {
    const notations = row.trim().split(/\s+/);
    if (notations.length !== size) {
      throw new RangeError("Magic square board rows must match the board size");
    }
    return notations.map(function parseCell(notation): MagicSquareCell {
      if (notation === ".") {
        return null;
      }
      if (!/^[1-9][0-9]*$/.test(notation)) {
        throw new RangeError(`Unknown magic square cell notation: ${notation}`);
      }
      return Number(notation);
    });
  });
  const board = { size, cells };
  assertMagicSquareBoard(board);
  return board;
}

export function getMagicSquareCellPosition(
  size: number,
  cellIndex: number,
): MagicSquareCellPosition {
  return { row: Math.floor(cellIndex / size), column: cellIndex % size };
}

/** 行（上から）、縦の列（左から）、左上からの斜め、右上からの斜めの順。 */
export function listMagicSquareLines(size: number): MagicSquareLine[] {
  const indices = Array.from({ length: size }, (_, index) => index);
  return [
    ...indices.map((index): MagicSquareLine => ({ kind: "row", index })),
    ...indices.map((index): MagicSquareLine => ({ kind: "column", index })),
    { kind: "diagonal", from: "top-left" },
    { kind: "diagonal", from: "top-right" },
  ];
}

/** 列のマスを、上から（行は左から）順に返す。 */
export function getMagicSquareLineCellIndices(
  size: number,
  line: MagicSquareLine,
): number[] {
  return Array.from({ length: size }, function getCellIndex(_, position) {
    if (line.kind === "row") {
      return line.index * size + position;
    }
    if (line.kind === "column") {
      return position * size + line.index;
    }
    return line.from === "top-left"
      ? position * size + position
      : position * size + (size - 1 - position);
  });
}

export function isSameMagicSquareLine(
  left: MagicSquareLine,
  right: MagicSquareLine,
): boolean {
  if (left.kind === "diagonal" || right.kind === "diagonal") {
    return (
      left.kind === "diagonal" &&
      right.kind === "diagonal" &&
      left.from === right.from
    );
  }
  return left.kind === right.kind && left.index === right.index;
}

/** マスを通る列。行と縦の列の2本に、斜めの上にあるマスはその斜めを足す。並びは `listMagicSquareLines` と同じ。 */
export function listMagicSquareLinesThroughCell(
  size: number,
  cellIndex: number,
): MagicSquareLine[] {
  return listMagicSquareLines(size).filter((line) =>
    getMagicSquareLineCellIndices(size, line).includes(cellIndex),
  );
}

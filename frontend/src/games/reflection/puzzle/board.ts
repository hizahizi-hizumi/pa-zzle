/**
 * 盤面に置くピースの種類。
 * - `slash` / `backslash`: 片面の斜め鏡。光を90度曲げる。
 * - `vertical-double` / `horizontal-double`: 縦・横向きの両面鏡。鏡面に沿う光は素通りし、鏡面に当たる光は来た方向へ返す。
 * - `reflector`: 全方向反射体。どの方向から来た光も来た方向へ返す。
 * - `black-hole`: 光を吸収する。
 */
export const reflectionPieces = [
  "slash",
  "backslash",
  "vertical-double",
  "horizontal-double",
  "reflector",
  "black-hole",
] as const;

export type ReflectionPiece = (typeof reflectionPieces)[number];

/** `null` はピースの無いマス。光は直進する。 */
export type ReflectionCell = ReflectionPiece | null;

/** 一辺 `size` の正方形盤面。`cells` は行優先で並べる。 */
export type ReflectionBoard = {
  size: number;
  cells: readonly ReflectionCell[];
};

/** 手持ちのピースの種類ごとの個数。 */
export type ReflectionInventory = Readonly<Record<ReflectionPiece, number>>;

const cellByNotation = {
  "/": "slash",
  "\\": "backslash",
  "|": "vertical-double",
  "=": "horizontal-double",
  o: "reflector",
  "@": "black-hole",
  ".": null,
} as const satisfies Record<string, ReflectionCell>;

type ReflectionCellNotation = keyof typeof cellByNotation;

function isReflectionCellNotation(
  value: string,
): value is ReflectionCellNotation {
  return Object.hasOwn(cellByNotation, value);
}

export function assertReflectionBoard(board: ReflectionBoard): void {
  if (!Number.isInteger(board.size) || board.size < 1) {
    throw new RangeError("Reflection board size must be a positive integer");
  }

  if (board.cells.length !== board.size * board.size) {
    throw new RangeError("Reflection board cells must fill a square board");
  }
}

/**
 * 1行を1文字列とした記法から盤面を作る。
 * `/` `\` が斜め鏡、`|` `=` が縦・横の両面鏡、`o` が全方向反射体、`@` がブラックホール、`.` が空きマス。
 * 固定問題やテストで盤面を読みやすく書くための記法。
 */
export function parseReflectionBoard(rows: readonly string[]): ReflectionBoard {
  const isSquare = rows.every((row) => row.length === rows.length);
  if (!isSquare) {
    throw new RangeError("Reflection board rows must match the board size");
  }

  const cells = rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isReflectionCellNotation(notation)) {
        throw new RangeError(`Unknown Reflection cell notation: ${notation}`);
      }
      return cellByNotation[notation];
    });
  });
  const board = { size: rows.length, cells };
  assertReflectionBoard(board);
  return board;
}

export function createEmptyReflectionBoard(size: number): ReflectionBoard {
  const board = {
    size,
    cells: new Array<ReflectionCell>(size * size).fill(null),
  };
  assertReflectionBoard(board);
  return board;
}

export function createEmptyReflectionInventory(): Record<
  ReflectionPiece,
  number
> {
  return {
    slash: 0,
    backslash: 0,
    "vertical-double": 0,
    "horizontal-double": 0,
    reflector: 0,
    "black-hole": 0,
  };
}

/** 盤面に置かれているピースを種類ごとに数える。 */
export function countReflectionBoardPieces(
  board: ReflectionBoard,
): ReflectionInventory {
  const counts = createEmptyReflectionInventory();
  for (const cell of board.cells) {
    if (cell !== null) {
      counts[cell] += 1;
    }
  }
  return counts;
}

export function getReflectionInventoryPieceCount(
  inventory: ReflectionInventory,
): number {
  return reflectionPieces.reduce((total, piece) => total + inventory[piece], 0);
}

export function isSameReflectionInventory(
  left: ReflectionInventory,
  right: ReflectionInventory,
): boolean {
  return reflectionPieces.every((piece) => left[piece] === right[piece]);
}

export function getReflectionCellPosition(
  size: number,
  cellIndex: number,
): { row: number; column: number } {
  return { row: Math.floor(cellIndex / size), column: cellIndex % size };
}

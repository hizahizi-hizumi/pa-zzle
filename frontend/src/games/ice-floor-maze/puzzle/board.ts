/**
 * 盤面のマスの種類。
 * - `ice`: 氷。駒は止まらずに滑り抜ける。
 * - `rock`: 岩。外壁と同じく、駒はその手前で止まる。
 */
export type IceFloorMazeCell = "ice" | "rock";

/** 幅 `width` 列 × 高さ `height` 行の盤面。`cells` は行優先で並べ、マスの番号は `y * width + x`。 */
export type IceFloorMazeBoard = {
  width: number;
  height: number;
  cells: readonly IceFloorMazeCell[];
};

const cellByNotation = {
  ".": "ice",
  "#": "rock",
} as const satisfies Record<string, IceFloorMazeCell>;

type IceFloorMazeCellNotation = keyof typeof cellByNotation;

function isIceFloorMazeCellNotation(
  value: string,
): value is IceFloorMazeCellNotation {
  return Object.hasOwn(cellByNotation, value);
}

export function assertIceFloorMazeBoard(board: IceFloorMazeBoard): void {
  if (
    !Number.isInteger(board.width) ||
    !Number.isInteger(board.height) ||
    board.width < 1 ||
    board.height < 1
  ) {
    throw new RangeError(
      "Ice floor maze board width and height must be positive integers",
    );
  }

  if (board.cells.length !== board.width * board.height) {
    throw new RangeError("Ice floor maze board cells must fill the board");
  }

  if (!board.cells.every((cell) => cell === "ice" || cell === "rock")) {
    throw new RangeError("Ice floor maze board cells must be ice or rock");
  }
}

/**
 * 1行を1文字列とした記法から盤面を作る。`.` が氷、`#` が岩。
 * 固定問題やテストで盤面を読みやすく書くための記法。
 */
export function parseIceFloorMazeBoard(
  rows: readonly string[],
): IceFloorMazeBoard {
  const width = rows[0]?.length ?? 0;
  if (!rows.every((row) => row.length === width)) {
    throw new RangeError("Ice floor maze board rows must have the same width");
  }

  const cells = rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isIceFloorMazeCellNotation(notation)) {
        throw new RangeError(
          `Unknown ice floor maze cell notation: ${notation}`,
        );
      }
      return cellByNotation[notation];
    });
  });
  const board = { width, height: rows.length, cells };
  assertIceFloorMazeBoard(board);
  return board;
}

export function isIceFloorMazeCellIndex(
  board: IceFloorMazeBoard,
  cellIndex: number,
): boolean {
  return (
    Number.isInteger(cellIndex) &&
    cellIndex >= 0 &&
    cellIndex < board.cells.length
  );
}

/** 駒を置ける氷のマスか。盤面の外は氷のマスではない。 */
export function isIceFloorMazeIceCell(
  board: IceFloorMazeBoard,
  cellIndex: number,
): boolean {
  return (
    isIceFloorMazeCellIndex(board, cellIndex) &&
    board.cells[cellIndex] === "ice"
  );
}

export function getIceFloorMazeCellPosition(
  board: IceFloorMazeBoard,
  cellIndex: number,
): { x: number; y: number } {
  return { x: cellIndex % board.width, y: Math.floor(cellIndex / board.width) };
}

/**
 * 初期盤面のマスの種類。
 * - `ice`: 氷。駒は止まらずに滑り抜ける。
 * - `rock`: 岩。外壁と同じく、駒はその手前で止まる。
 * - `brittle-rock`: もろい岩。岩と同じ止め役で、駒が滑ってきてその手前で止まると、その滑りの後で崩れて氷になる。
 * - `thin-ice`: 薄い氷。氷と同じく滑れ、駒が離れると割れて水面（止め役）になる。
 * - `outside`: 盤面の外。外壁と同じ止め役で、盤面として描かない。
 */
export type IceFloorMazeCell =
  | "ice"
  | "rock"
  | "brittle-rock"
  | "thin-ice"
  | "outside";

export const iceFloorMazeCells = [
  "ice",
  "rock",
  "brittle-rock",
  "thin-ice",
  "outside",
] as const satisfies readonly IceFloorMazeCell[];

/** 解いている途中で崩れたり割れたりして変わる要素（もろい岩・薄い氷）。 */
export type IceFloorMazeChangeableCell = Extract<
  IceFloorMazeCell,
  "brittle-rock" | "thin-ice"
>;

/** 幅 `width` 列 × 高さ `height` 行の盤面。`cells` は行優先で並べ、マスの番号は `y * width + x`。 */
export type IceFloorMazeBoard = {
  width: number;
  height: number;
  cells: readonly IceFloorMazeCell[];
};

const cellByNotation = {
  ".": "ice",
  "#": "rock",
  b: "brittle-rock",
  c: "thin-ice",
  x: "outside",
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

  const knownCells: ReadonlySet<string> = new Set(iceFloorMazeCells);
  if (!board.cells.every((cell) => knownCells.has(cell))) {
    throw new RangeError("Ice floor maze board has an unknown cell");
  }
}

/**
 * 1行を1文字列とした記法から盤面を作る。`.` が氷、`#` が岩、`b` がもろい岩、`c` が薄い氷、`x` が盤面の外。
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

/** 開始位置・ゴールに置ける氷のマスか。薄い氷・盤面の外・番号の範囲の外は氷のマスではない。 */
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

export function isIceFloorMazeChangeableCell(
  cell: IceFloorMazeCell,
): cell is IceFloorMazeChangeableCell {
  return cell === "brittle-rock" || cell === "thin-ice";
}

/** 要素（もろい岩・薄い氷）の無い、解いている途中で変わらない盤面か。 */
export function isIceFloorMazeStaticBoard(board: IceFloorMazeBoard): boolean {
  return !board.cells.some(isIceFloorMazeChangeableCell);
}

/** 盤面として描くマスの数。盤面の外を除く。 */
export function countIceFloorMazeDrawnCells(board: IceFloorMazeBoard): number {
  return board.cells.filter((cell) => cell !== "outside").length;
}

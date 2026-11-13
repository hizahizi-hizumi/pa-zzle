export type IceFloorMazeCell =
  | "ice"
  | "rock"
  | "brittle-rock"
  | "thin-ice"
  | "outside"
  | "floor"
  | "snow"
  | "sliding-block";

/** マスの種類の並び。問題の identity の符号はこの順の番号を使うので、種類を足すときは末尾に足す。 */
export const iceFloorMazeCells = [
  "ice",
  "rock",
  "brittle-rock",
  "thin-ice",
  "outside",
  "floor",
  "snow",
  "sliding-block",
] as const satisfies readonly IceFloorMazeCell[];

export type IceFloorMazeChangeableCell = Extract<
  IceFloorMazeCell,
  "brittle-rock" | "thin-ice" | "snow" | "sliding-block"
>;

/** `cells` は行優先で並べ、マスの番号は `y * width + x`。 */
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
  o: "floor",
  s: "snow",
  m: "sliding-block",
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

/** 固定問題やテストで盤面を読みやすく書くための記法。 */
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
  return (
    cell === "brittle-rock" ||
    cell === "thin-ice" ||
    cell === "snow" ||
    cell === "sliding-block"
  );
}

/** 要素（もろい岩・薄い氷・雪・滑る氷の塊）の無い、解いている途中で変わらない盤面か。床は変わらないので、床があってもよい。 */
export function isIceFloorMazeStaticBoard(board: IceFloorMazeBoard): boolean {
  return !board.cells.some(isIceFloorMazeChangeableCell);
}

export function countIceFloorMazeDrawnCells(board: IceFloorMazeBoard): number {
  return board.cells.filter((cell) => cell !== "outside").length;
}

/** 1本の行か列。`index` は行なら上から、列なら左からの0始まりの番号。 */
export type NonogramLine = {
  axis: "row" | "column";
  index: number;
};

/** 盤面の大きさ。マスは行優先で `row * width + column` の位置に並べる。 */
export type NonogramGridSize = {
  width: number;
  height: number;
};

/**
 * プレイヤーが各マスに入れた状態。
 * - `unknown`: まだ何も入れていないマス。
 * - `filled`: 黒と考えて塗ったマス。
 * - `crossed`: 白と考えて × を付けたマス。× はメモで、クリアの判定に使わない。
 */
export type NonogramCellState = "unknown" | "filled" | "crossed";

export type NonogramBoard = NonogramGridSize & {
  cells: readonly NonogramCellState[];
};

const cellStateByNotation = {
  ".": "unknown",
  "#": "filled",
  x: "crossed",
} as const satisfies Record<string, NonogramCellState>;

type NonogramCellNotation = keyof typeof cellStateByNotation;

function isNonogramCellNotation(value: string): value is NonogramCellNotation {
  return Object.hasOwn(cellStateByNotation, value);
}

export function assertNonogramGridSize({
  width,
  height,
}: NonogramGridSize): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new RangeError("Nonogram width and height must be positive integers");
  }
}

export function assertNonogramBoard(board: NonogramBoard): void {
  assertNonogramGridSize(board);
  if (board.cells.length !== board.width * board.height) {
    throw new RangeError("Nonogram board cells must fill the board");
  }
}

export function createEmptyNonogramBoard(
  size: NonogramGridSize,
): NonogramBoard {
  assertNonogramGridSize(size);
  return {
    width: size.width,
    height: size.height,
    cells: new Array<NonogramCellState>(size.width * size.height).fill(
      "unknown",
    ),
  };
}

/**
 * 1行を1文字列とした記法から盤面を作る。`.` が未確定、`#` が塗り、`x` が ×。
 * テストや固定の盤面を読みやすく書くための記法。
 */
export function parseNonogramBoard(rows: readonly string[]): NonogramBoard {
  const width = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== width)) {
    throw new RangeError("Nonogram board rows must share a width");
  }

  const cells = rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isNonogramCellNotation(notation)) {
        throw new RangeError(`Unknown Nonogram cell notation: ${notation}`);
      }
      return cellStateByNotation[notation];
    });
  });
  const board = { width, height: rows.length, cells };
  assertNonogramBoard(board);
  return board;
}

/** 行をすべて上から並べ、続けて列をすべて左から並べる。 */
export function listNonogramLines({
  width,
  height,
}: NonogramGridSize): NonogramLine[] {
  const rows = Array.from({ length: height }, function createRow(_, index) {
    return { axis: "row", index } as const;
  });
  const columns = Array.from(
    { length: width },
    function createColumn(_, index) {
      return { axis: "column", index } as const;
    },
  );
  return [...rows, ...columns];
}

/** 行なら左から、列なら上から順に、その線のマスの位置を返す。 */
export function getNonogramLineCellIndices(
  { width, height }: NonogramGridSize,
  line: NonogramLine,
): number[] {
  return line.axis === "row"
    ? Array.from({ length: width }, (_, column) => line.index * width + column)
    : Array.from({ length: height }, (_, row) => row * width + line.index);
}

export function getNonogramLineCellStates(
  board: NonogramBoard,
  line: NonogramLine,
): NonogramCellState[] {
  return getNonogramLineCellIndices(board, line).map(
    function getCellState(cellIndex) {
      return board.cells[cellIndex] ?? "unknown";
    },
  );
}

/** 盤面外のマスや、すでに同じ状態のマスは変えず、同じ盤面をそのまま返す。 */
export function setNonogramCellState(
  board: NonogramBoard,
  cellIndex: number,
  state: NonogramCellState,
): NonogramBoard {
  const currentState = board.cells[cellIndex];
  if (currentState === undefined || currentState === state) {
    return board;
  }

  const cells = [...board.cells];
  cells[cellIndex] = state;
  return { ...board, cells };
}

/** 盤面の列数と行数。どの問題も 4 列 × 5 行の箱。マスの番号は `row * HAKOIRI_MUSUME_COLUMNS + column`。 */
export const HAKOIRI_MUSUME_COLUMNS = 4;
export const HAKOIRI_MUSUME_ROWS = 5;
export const HAKOIRI_MUSUME_CELL_COUNT =
  HAKOIRI_MUSUME_COLUMNS * HAKOIRI_MUSUME_ROWS;

/**
 * 駒の種類。
 * - `daughter`: 娘。2 列 × 2 行。出口の前へ運ぶ駒で、1つの盤面にちょうど1つ。
 * - `vertical`: 縦長。1 列 × 2 行。
 * - `horizontal`: 横長。2 列 × 1 行。
 * - `small`: 小駒。1 列 × 1 行。
 */
export type HakoiriMusumePieceKind =
  | "daughter"
  | "vertical"
  | "horizontal"
  | "small";

export type HakoiriMusumePieceShape = {
  columns: number;
  rows: number;
};

export const hakoiriMusumePieceShapes = {
  daughter: { columns: 2, rows: 2 },
  vertical: { columns: 1, rows: 2 },
  horizontal: { columns: 2, rows: 1 },
  small: { columns: 1, rows: 1 },
} as const satisfies Record<HakoiriMusumePieceKind, HakoiriMusumePieceShape>;

/** 盤面の上の1つの駒。`cell` は駒の左上のマス。 */
export type HakoiriMusumePiece = {
  kind: HakoiriMusumePieceKind;
  cell: number;
};

export type HakoiriMusumeCellPosition = {
  row: number;
  column: number;
};

/**
 * 娘の左上がこのマスに着けばクリア。下から2段目・左から2列目で、娘が下辺の真ん中2マスの出口の前に来た位置。
 */
export const HAKOIRI_MUSUME_GOAL_CELL = 3 * HAKOIRI_MUSUME_COLUMNS + 1;

/** 下辺のうち出口になっている列（左から2列目と3列目）。 */
export const hakoiriMusumeExitColumns = [1, 2] as const;

export function getHakoiriMusumeCellPosition(
  cell: number,
): HakoiriMusumeCellPosition {
  return {
    row: Math.floor(cell / HAKOIRI_MUSUME_COLUMNS),
    column: cell % HAKOIRI_MUSUME_COLUMNS,
  };
}

export function getHakoiriMusumeCell({
  row,
  column,
}: HakoiriMusumeCellPosition): number {
  return row * HAKOIRI_MUSUME_COLUMNS + column;
}

/** 駒の左上を `position` に置いたとき、駒が箱の内側に収まるか。 */
export function isHakoiriMusumePieceInsideBoard(
  kind: HakoiriMusumePieceKind,
  { row, column }: HakoiriMusumeCellPosition,
): boolean {
  const shape = hakoiriMusumePieceShapes[kind];
  return (
    row >= 0 &&
    column >= 0 &&
    row + shape.rows <= HAKOIRI_MUSUME_ROWS &&
    column + shape.columns <= HAKOIRI_MUSUME_COLUMNS
  );
}

/** 駒の左上を `position` に置いたとき、駒が覆うマス。箱の内側に収まる位置だけを渡す。 */
export function listHakoiriMusumePieceCellsAt(
  kind: HakoiriMusumePieceKind,
  { row, column }: HakoiriMusumeCellPosition,
): number[] {
  const shape = hakoiriMusumePieceShapes[kind];
  const cells: number[] = [];
  for (let rowOffset = 0; rowOffset < shape.rows; rowOffset += 1) {
    for (
      let columnOffset = 0;
      columnOffset < shape.columns;
      columnOffset += 1
    ) {
      cells.push(
        getHakoiriMusumeCell({
          row: row + rowOffset,
          column: column + columnOffset,
        }),
      );
    }
  }
  return cells;
}

export function listHakoiriMusumePieceCells(
  piece: HakoiriMusumePiece,
): number[] {
  return listHakoiriMusumePieceCellsAt(
    piece.kind,
    getHakoiriMusumeCellPosition(piece.cell),
  );
}

/**
 * 盤面の20文字の書き方。行優先に1マス1文字で、駒の各マスに駒の種類と駒の中の位置を書く。
 * 娘は4マスとも `A`、縦長は上が `v`・下が `w`、横長は左が `h`・右が `i`、小駒は `s`、空きは `.`。
 * 例: 合意の易しい例は `vAAv` `wAAw` `v..v` `whiw` `s..s`（行ごと）を続けた `vAAvwAAwv..vwhiws..s`。
 */
export const hakoiriMusumeNotationByPieceCell = {
  daughter: ["A", "A", "A", "A"],
  vertical: ["v", "w"],
  horizontal: ["h", "i"],
  small: ["s"],
} as const satisfies Record<HakoiriMusumePieceKind, readonly string[]>;

export const hakoiriMusumePieceKindByLeadingNotation = {
  A: "daughter",
  v: "vertical",
  h: "horizontal",
  s: "small",
} as const satisfies Record<string, HakoiriMusumePieceKind>;

const emptyCellNotation = ".";

/** 盤面の20文字の1文字が、駒の始まり（左上）の書き方か。 */
export function isHakoiriMusumeLeadingNotation(
  character: string,
): character is keyof typeof hakoiriMusumePieceKindByLeadingNotation {
  return Object.hasOwn(hakoiriMusumePieceKindByLeadingNotation, character);
}

/** 駒の並びを盤面の20文字にする。駒は重ならず箱に収まっているものとする。 */
export function formatHakoiriMusumeBoard(
  pieces: readonly HakoiriMusumePiece[],
): string {
  const characters: string[] = Array.from(
    { length: HAKOIRI_MUSUME_CELL_COUNT },
    () => emptyCellNotation,
  );
  for (const piece of pieces) {
    const notations = hakoiriMusumeNotationByPieceCell[piece.kind];
    listHakoiriMusumePieceCells(piece).forEach((cell, index) => {
      characters[cell] = notations[index]!;
    });
  }
  return characters.join("");
}

/**
 * 盤面の20文字を、左上のマスの順に並べた駒にする。文字数・文字の種類・駒の形のどれかが合わなければ `null`。
 * 娘の数は確かめない（問題としての条件は `problem/` が確かめる）。
 */
export function parseHakoiriMusumeBoard(
  text: string,
): HakoiriMusumePiece[] | null {
  if (text.length !== HAKOIRI_MUSUME_CELL_COUNT) {
    return null;
  }
  const covered = new Array<boolean>(HAKOIRI_MUSUME_CELL_COUNT).fill(false);
  const pieces: HakoiriMusumePiece[] = [];
  for (let cell = 0; cell < HAKOIRI_MUSUME_CELL_COUNT; cell += 1) {
    const character = text[cell]!;
    if (covered[cell] || character === emptyCellNotation) {
      continue;
    }
    if (!isHakoiriMusumeLeadingNotation(character)) {
      return null;
    }
    const kind = hakoiriMusumePieceKindByLeadingNotation[character];
    const position = getHakoiriMusumeCellPosition(cell);
    if (!isHakoiriMusumePieceInsideBoard(kind, position)) {
      return null;
    }
    const notations = hakoiriMusumeNotationByPieceCell[kind];
    const pieceCells = listHakoiriMusumePieceCellsAt(kind, position);
    const matches = pieceCells.every(
      (pieceCell, index) =>
        !covered[pieceCell] && text[pieceCell] === notations[index],
    );
    if (!matches) {
      return null;
    }
    for (const pieceCell of pieceCells) {
      covered[pieceCell] = true;
    }
    pieces.push({ kind, cell });
  }
  return pieces;
}

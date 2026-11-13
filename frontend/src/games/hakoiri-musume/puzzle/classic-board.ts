import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumeLayout,
  type HakoiriMusumePiece,
  isHakoiriMusumePieceInsideBoard,
  listHakoiriMusumePieceCells,
  listHakoiriMusumePieceCellsAt,
} from "@/games/hakoiri-musume/puzzle/board";

/** 基準の盤（4 列 × 5 行・壁なし・娘1つ・下辺の真ん中2マスの出口）。この盤の盤面は20文字で書く。 */
export const HAKOIRI_MUSUME_CLASSIC_COLUMNS = 4;
export const HAKOIRI_MUSUME_CLASSIC_ROWS = 5;
export const HAKOIRI_MUSUME_CLASSIC_CELL_COUNT =
  HAKOIRI_MUSUME_CLASSIC_COLUMNS * HAKOIRI_MUSUME_CLASSIC_ROWS;

const classicSize = {
  columns: HAKOIRI_MUSUME_CLASSIC_COLUMNS,
  rows: HAKOIRI_MUSUME_CLASSIC_ROWS,
} as const;

/** 下から2段目・左から2列目で、娘が下辺の真ん中2マスの出口の前に来た位置。 */
export const HAKOIRI_MUSUME_CLASSIC_GOAL_CELL =
  3 * HAKOIRI_MUSUME_CLASSIC_COLUMNS + 1;

const classicExitColumns = [1, 2] as const;

export const hakoiriMusumeClassicLayout = {
  columns: HAKOIRI_MUSUME_CLASSIC_COLUMNS,
  rows: HAKOIRI_MUSUME_CLASSIC_ROWS,
  walls: [],
  goals: [
    {
      placements: [HAKOIRI_MUSUME_CLASSIC_GOAL_CELL],
      exitSide: "bottom",
      exitCells: classicExitColumns.map((column) =>
        getHakoiriMusumeCell(classicSize, {
          row: HAKOIRI_MUSUME_CLASSIC_ROWS - 1,
          column,
        }),
      ),
    },
  ],
} as const satisfies HakoiriMusumeLayout;

export type HakoiriMusumeClassicPieceKind =
  | "square"
  | "vertical"
  | "horizontal"
  | "small";

export const hakoiriMusumeClassicPieceKinds = [
  "square",
  "vertical",
  "horizontal",
  "small",
] as const satisfies readonly HakoiriMusumeClassicPieceKind[];

export function isHakoiriMusumeClassicPieceKind(
  kind: string,
): kind is HakoiriMusumeClassicPieceKind {
  return (hakoiriMusumeClassicPieceKinds as readonly string[]).includes(kind);
}

export function getHakoiriMusumeClassicCellPosition(
  cell: number,
): HakoiriMusumeCellPosition {
  return getHakoiriMusumeCellPosition(classicSize, cell);
}

export function getHakoiriMusumeClassicCell(
  position: HakoiriMusumeCellPosition,
): number {
  return getHakoiriMusumeCell(classicSize, position);
}

export function isHakoiriMusumeClassicPieceInsideBoard(
  kind: HakoiriMusumeClassicPieceKind,
  position: HakoiriMusumeCellPosition,
): boolean {
  return isHakoiriMusumePieceInsideBoard(classicSize, kind, position);
}

/** 盤の内側に収まる位置だけを渡す。 */
export function listHakoiriMusumeClassicPieceCellsAt(
  kind: HakoiriMusumeClassicPieceKind,
  position: HakoiriMusumeCellPosition,
): number[] {
  return listHakoiriMusumePieceCellsAt(classicSize, kind, position);
}

export function listHakoiriMusumeClassicPieceCells(
  piece: Pick<HakoiriMusumePiece, "kind" | "cell">,
): number[] {
  return listHakoiriMusumePieceCells(classicSize, piece);
}

/**
 * 盤面の20文字の書き方。行優先に1マス1文字で、駒の各マスに駒の種類と駒の中の位置を書く。
 * 娘は4マスとも `A`、縦長は上が `v`・下が `w`、横長は左が `h`・右が `i`、小駒は `s`、空きは `.`。
 * 例: 行ごとに `vAAv` `wAAw` `v..v` `whiw` `s..s` と書く盤面は `vAAvwAAwv..vwhiws..s`。
 */
export const hakoiriMusumeNotationByPieceCell = {
  square: ["A", "A", "A", "A"],
  vertical: ["v", "w"],
  horizontal: ["h", "i"],
  small: ["s"],
} as const satisfies Record<HakoiriMusumeClassicPieceKind, readonly string[]>;

export const hakoiriMusumePieceKindByLeadingNotation = {
  A: "square",
  v: "vertical",
  h: "horizontal",
  s: "small",
} as const satisfies Record<string, HakoiriMusumeClassicPieceKind>;

const emptyCellNotation = ".";

export function isHakoiriMusumeLeadingNotation(
  character: string,
): character is keyof typeof hakoiriMusumePieceKindByLeadingNotation {
  return Object.hasOwn(hakoiriMusumePieceKindByLeadingNotation, character);
}

/** 基準の盤の形の駒だけで、目標の駒が娘だけなら書ける。 */
export function isHakoiriMusumeClassicArrangement(
  pieces: readonly HakoiriMusumePiece[],
): boolean {
  return pieces.every(
    (piece) =>
      isHakoiriMusumeClassicPieceKind(piece.kind) &&
      (piece.kind === "square") === (piece.target === 0),
  );
}

/** 駒は基準の盤の形で、重ならず箱に収まっているものとする。 */
export function formatHakoiriMusumeClassicBoard(
  pieces: readonly HakoiriMusumePiece[],
): string {
  const characters: string[] = Array.from(
    { length: HAKOIRI_MUSUME_CLASSIC_CELL_COUNT },
    () => emptyCellNotation,
  );
  for (const piece of pieces) {
    if (!isHakoiriMusumeClassicPieceKind(piece.kind)) {
      throw new RangeError(
        `Hakoiri musume classic board has no ${piece.kind} piece`,
      );
    }
    const notations = hakoiriMusumeNotationByPieceCell[piece.kind];
    listHakoiriMusumeClassicPieceCells(piece).forEach((cell, index) => {
      characters[cell] = notations[index]!;
    });
  }
  return characters.join("");
}

/**
 * 盤面の20文字を、左上のマスの順に並べた駒にする。娘は目標の駒（`target: 0`）にする。
 * 文字数・文字の種類・駒の形のどれかが合わなければ `null`。娘の数は確かめない（問題としての条件は `problem/` が確かめる）。
 */
export function parseHakoiriMusumeClassicBoard(
  text: string,
): HakoiriMusumePiece[] | null {
  if (text.length !== HAKOIRI_MUSUME_CLASSIC_CELL_COUNT) {
    return null;
  }
  const covered = new Array<boolean>(HAKOIRI_MUSUME_CLASSIC_CELL_COUNT).fill(
    false,
  );
  const pieces: HakoiriMusumePiece[] = [];
  for (let cell = 0; cell < HAKOIRI_MUSUME_CLASSIC_CELL_COUNT; cell += 1) {
    const character = text[cell]!;
    if (covered[cell] || character === emptyCellNotation) {
      continue;
    }
    if (!isHakoiriMusumeLeadingNotation(character)) {
      return null;
    }
    const kind = hakoiriMusumePieceKindByLeadingNotation[character];
    const position = getHakoiriMusumeClassicCellPosition(cell);
    if (!isHakoiriMusumeClassicPieceInsideBoard(kind, position)) {
      return null;
    }
    const notations = hakoiriMusumeNotationByPieceCell[kind];
    const pieceCells = listHakoiriMusumeClassicPieceCellsAt(kind, position);
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
    pieces.push({ kind, cell, target: kind === "square" ? 0 : null });
  }
  return pieces;
}

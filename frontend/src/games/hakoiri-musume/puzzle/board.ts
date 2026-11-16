export const HAKOIRI_MUSUME_MIN_SIDE = 4;
export const HAKOIRI_MUSUME_MAX_SIDE = 6;

export const HAKOIRI_MUSUME_MAX_TARGETS = 2;

export type HakoiriMusumeCellPosition = {
  row: number;
  column: number;
};

/**
 * 駒の形。`cells` は駒の占めるマスで、形の外接矩形の左上を `{ row: 0, column: 0 }` とした相対の位置を、行・列の順に並べる。
 * `columns`・`rows` は外接矩形の幅と高さ。
 */
export type HakoiriMusumePieceShape = {
  columns: number;
  rows: number;
  cells: readonly HakoiriMusumeCellPosition[];
};

/** 行ごとの文字列（`#` が駒の占めるマス）から形を作る。 */
function createShape(rows: readonly string[]): HakoiriMusumePieceShape {
  const cells = rows.flatMap((line, row) =>
    [...line].flatMap((mark, column) =>
      mark === "#" ? [{ row, column }] : [],
    ),
  );
  return { columns: rows[0]!.length, rows: rows.length, cells };
}

/**
 * 形は占めるマスの並びだけで決まるので、ここへ足した形は盤・手・描画がそのまま扱う。
 * `bend-*` は、角のマスから2本の腕が伸びる向きで呼ぶ（`bend-up-right` は ┗）。
 */
export const hakoiriMusumePieceShapes = {
  square: createShape(["##", "##"]),
  vertical: createShape(["#", "#"]),
  horizontal: createShape(["##"]),
  small: createShape(["#"]),
  "bend-up-right": createShape(["#.", "##"]),
  "bend-up-left": createShape([".#", "##"]),
  "bend-down-right": createShape(["##", "#."]),
  "bend-down-left": createShape(["##", ".#"]),
} as const satisfies Record<string, HakoiriMusumePieceShape>;

export type HakoiriMusumePieceKind = keyof typeof hakoiriMusumePieceShapes;

export const hakoiriMusumePieceKinds = Object.keys(
  hakoiriMusumePieceShapes,
) as readonly HakoiriMusumePieceKind[];

export function isHakoiriMusumeRectangularKind(
  kind: HakoiriMusumePieceKind,
): boolean {
  const shape = hakoiriMusumePieceShapes[kind];
  return shape.cells.length === shape.columns * shape.rows;
}

/**
 * 盤面の上の1つの駒。`cell` は駒の形の外接矩形の左上のマス（L字では駒の占めないマスのこともある）。
 * `target` は、目標の駒なら盤の作りの `goals` の何番目の行き先へ運ぶか、ほかの駒なら `null`。
 */
export type HakoiriMusumePiece = {
  kind: HakoiriMusumePieceKind;
  cell: number;
  target: number | null;
};

export const hakoiriMusumeExitSides = [
  "top",
  "right",
  "bottom",
  "left",
] as const;

export type HakoiriMusumeExitSide = (typeof hakoiriMusumeExitSides)[number];

/**
 * 目標の駒の行き先。
 * - `placements`: その駒の左上（`HakoiriMusumePiece.cell`）がどれかに着けばよいマス。1つ以上。
 * - `exitSide`・`exitCells`: 出口のある辺と、出口に面した盤の端のマス（辺に沿って続く1つ以上のマス）。
 *   クリアした目標の駒は、ここから箱の外へ抜ける。
 */
export type HakoiriMusumeGoal = {
  placements: readonly number[];
  exitSide: HakoiriMusumeExitSide;
  exitCells: readonly number[];
};

/**
 * 盤の作り。マスの番号は `row * columns + column`。
 * - `columns`・`rows`: 盤の幅と高さ（`HAKOIRI_MUSUME_MIN_SIDE`〜`HAKOIRI_MUSUME_MAX_SIDE`）。
 * - `walls`: 駒が入れないマス。
 * - `goals`: 目標の駒ごとの行き先（1〜`HAKOIRI_MUSUME_MAX_TARGETS`）。`goals[k]` は `target === k` の駒の行き先。
 */
export type HakoiriMusumeLayout = {
  columns: number;
  rows: number;
  walls: readonly number[];
  goals: readonly HakoiriMusumeGoal[];
};

export type HakoiriMusumeBoardSize = Pick<
  HakoiriMusumeLayout,
  "columns" | "rows"
>;

export function getHakoiriMusumeCellPosition(
  size: HakoiriMusumeBoardSize,
  cell: number,
): HakoiriMusumeCellPosition {
  return {
    row: Math.floor(cell / size.columns),
    column: cell % size.columns,
  };
}

export function getHakoiriMusumeCell(
  size: HakoiriMusumeBoardSize,
  { row, column }: HakoiriMusumeCellPosition,
): number {
  return row * size.columns + column;
}

export function countHakoiriMusumeCells(size: HakoiriMusumeBoardSize): number {
  return size.columns * size.rows;
}

export function isHakoiriMusumePieceInsideBoard(
  size: HakoiriMusumeBoardSize,
  kind: HakoiriMusumePieceKind,
  { row, column }: HakoiriMusumeCellPosition,
): boolean {
  const shape = hakoiriMusumePieceShapes[kind];
  return (
    row >= 0 &&
    column >= 0 &&
    row + shape.rows <= size.rows &&
    column + shape.columns <= size.columns
  );
}

/** 盤の内側に収まる位置だけを渡す。 */
export function listHakoiriMusumePieceCellsAt(
  size: HakoiriMusumeBoardSize,
  kind: HakoiriMusumePieceKind,
  { row, column }: HakoiriMusumeCellPosition,
): number[] {
  return hakoiriMusumePieceShapes[kind].cells.map((offset) =>
    getHakoiriMusumeCell(size, {
      row: row + offset.row,
      column: column + offset.column,
    }),
  );
}

export function listHakoiriMusumePieceCells(
  size: HakoiriMusumeBoardSize,
  piece: Pick<HakoiriMusumePiece, "kind" | "cell">,
): number[] {
  return listHakoiriMusumePieceCellsAt(
    size,
    piece.kind,
    getHakoiriMusumeCellPosition(size, piece.cell),
  );
}

/**
 * 駒の並びを見分ける鍵。目標でない同じ形の駒どうしが入れ替わっただけの並びは同じ鍵になり、目標の駒は行き先ごとに見分ける。
 */
export function getHakoiriMusumeArrangementKey(
  pieces: readonly HakoiriMusumePiece[],
): string {
  return pieces
    .map((piece) => `${piece.kind}/${piece.target ?? ""}@${piece.cell}`)
    .sort()
    .join(" ");
}

import {
  countHakoiriMusumeCells,
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeBoardSize,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumeExitSide,
  type HakoiriMusumeGoal,
  type HakoiriMusumeLayout,
  type HakoiriMusumePiece,
  type HakoiriMusumePieceKind,
  hakoiriMusumeExitSides,
  hakoiriMusumePieceKinds,
  hakoiriMusumePieceShapes,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 盤の作りと駒の並びを1つの文字列に書く書き方。`;` で区切った次の欄を続ける。
 * 1. 盤の大きさ `<幅>x<高さ>`。
 * 2. 盤のマス。行を `/` で区切り、1マス1文字で `.` 空き、`#` 壁、`A`・`B` は1つ目・2つ目の目標の駒、ほかの駒は駒ごとに
 *    `a`〜`z`・`0`〜`9` の1文字。駒の形は同じ文字のマスの並びから読む。文字は駒の最初のマス（行・列の順）の順に振る。
 * 3. 目標の駒ごとの行き先 `<出口の辺><出口の始め>-<出口の終わり>@<置き場所>`。出口の始めと終わりは、上・下の辺なら列、
 *    左・右の辺なら行の番号。置き場所は目標の駒の左上を置くマス `<行>.<列>` を `,` で並べる。
 * 例: `5x5;.AA../.AA../b.cdd/b.c../.eeff;bottom1-2@3.1`。
 */
const SECTION_SEPARATOR = ";";
const ROW_SEPARATOR = "/";
const EMPTY = ".";
const WALL = "#";
const targetLetters = ["A", "B"] as const;
const pieceLetters = "abcdefghijklmnopqrstuvwxyz0123456789";

function findKindOfCells(
  size: HakoiriMusumeBoardSize,
  cells: readonly number[],
): { kind: HakoiriMusumePieceKind; anchor: number } | null {
  const positions = cells.map((cell) =>
    getHakoiriMusumeCellPosition(size, cell),
  );
  const top = Math.min(...positions.map((position) => position.row));
  const left = Math.min(...positions.map((position) => position.column));
  const offsets = positions
    .map(({ row, column }) => `${row - top}.${column - left}`)
    .sort()
    .join(" ");
  const kind = hakoiriMusumePieceKinds.find(
    (candidate) =>
      hakoiriMusumePieceShapes[candidate].cells
        .map(({ row, column }) => `${row}.${column}`)
        .sort()
        .join(" ") === offsets,
  );
  return kind
    ? { kind, anchor: getHakoiriMusumeCell(size, { row: top, column: left }) }
    : null;
}

function formatPosition({ row, column }: HakoiriMusumeCellPosition): string {
  return `${row}.${column}`;
}

/** 出口のマスの、辺に沿った番号（上・下の辺は列、左・右の辺は行）。 */
function getExitIndex(
  size: HakoiriMusumeBoardSize,
  side: HakoiriMusumeExitSide,
  cell: number,
): number {
  const { row, column } = getHakoiriMusumeCellPosition(size, cell);
  return side === "top" || side === "bottom" ? column : row;
}

function getExitCell(
  size: HakoiriMusumeBoardSize,
  side: HakoiriMusumeExitSide,
  index: number,
): number {
  switch (side) {
    case "top":
      return getHakoiriMusumeCell(size, { row: 0, column: index });
    case "bottom":
      return getHakoiriMusumeCell(size, { row: size.rows - 1, column: index });
    case "left":
      return getHakoiriMusumeCell(size, { row: index, column: 0 });
    case "right":
      return getHakoiriMusumeCell(size, {
        row: index,
        column: size.columns - 1,
      });
  }
}

function formatGoal(
  size: HakoiriMusumeBoardSize,
  goal: HakoiriMusumeGoal,
): string {
  const indices = goal.exitCells.map((cell) =>
    getExitIndex(size, goal.exitSide, cell),
  );
  const placements = goal.placements
    .map((cell) => formatPosition(getHakoiriMusumeCellPosition(size, cell)))
    .join(",");
  return `${goal.exitSide}${Math.min(...indices)}-${Math.max(...indices)}@${placements}`;
}

/** 駒は重ならず盤に収まり、壁に乗っていないものとする。 */
export function formatHakoiriMusumeArrangement(
  layout: HakoiriMusumeLayout,
  pieces: readonly HakoiriMusumePiece[],
): string {
  const grid = Array.from({ length: countHakoiriMusumeCells(layout) }, () =>
    String(EMPTY),
  );
  for (const wall of layout.walls) {
    grid[wall] = WALL;
  }
  const ordered = pieces
    .map((piece) => listHakoiriMusumePieceCells(layout, piece))
    .map((cells, index) => ({ cells, piece: pieces[index]! }))
    .sort((left, right) => Math.min(...left.cells) - Math.min(...right.cells));
  let nextLetter = 0;
  for (const { cells, piece } of ordered) {
    const letter =
      piece.target === null
        ? pieceLetters[nextLetter++]!
        : targetLetters[piece.target]!;
    for (const cell of cells) {
      grid[cell] = letter;
    }
  }
  const rows = Array.from({ length: layout.rows }, (_, row) =>
    grid.slice(row * layout.columns, (row + 1) * layout.columns).join(""),
  );
  return [
    `${layout.columns}x${layout.rows}`,
    rows.join(ROW_SEPARATOR),
    ...layout.goals.map((goal) => formatGoal(layout, goal)),
  ].join(SECTION_SEPARATOR);
}

const sizePattern = /^([1-9])x([1-9])$/;
const goalPattern = /^(top|right|bottom|left)(\d)-(\d)@(\d\.\d(?:,\d\.\d)*)$/;

function isExitSide(value: string): value is HakoiriMusumeExitSide {
  return (hakoiriMusumeExitSides as readonly string[]).includes(value);
}

function parseGoal(
  size: HakoiriMusumeBoardSize,
  text: string,
): HakoiriMusumeGoal | null {
  const match = goalPattern.exec(text);
  if (!match || !isExitSide(match[1]!)) {
    return null;
  }
  const side = match[1];
  const first = Number(match[2]);
  const last = Number(match[3]);
  const length = side === "top" || side === "bottom" ? size.columns : size.rows;
  if (first > last || last >= length) {
    return null;
  }
  const placements = match[4]!.split(",").map((position) => {
    const [row, column] = position.split(".").map(Number) as [number, number];
    return row < size.rows && column < size.columns
      ? getHakoiriMusumeCell(size, { row, column })
      : null;
  });
  if (placements.includes(null)) {
    return null;
  }
  return {
    placements: placements as number[],
    exitSide: side,
    exitCells: Array.from({ length: last - first + 1 }, (_, offset) =>
      getExitCell(size, side, first + offset),
    ),
  };
}

/**
 * `formatHakoiriMusumeArrangement` の書き方の文字列を、盤の作りと、最初のマスの順に並べた駒にする。
 * 書き方に合わないか、駒の形が一覧に無ければ `null`。問題として成り立つか（大きさの範囲・目標の数・行き先）は `problem/` が確かめる。
 */
export function parseHakoiriMusumeArrangement(text: string): {
  layout: HakoiriMusumeLayout;
  pieces: HakoiriMusumePiece[];
} | null {
  const [sizeText, gridText, ...goalTexts] = text.split(SECTION_SEPARATOR);
  const sizeMatch = sizePattern.exec(sizeText ?? "");
  if (!sizeMatch || gridText === undefined) {
    return null;
  }
  const size = { columns: Number(sizeMatch[1]), rows: Number(sizeMatch[2]) };
  const rows = gridText.split(ROW_SEPARATOR);
  if (
    rows.length !== size.rows ||
    rows.some((row) => row.length !== size.columns)
  ) {
    return null;
  }
  const grid = rows.join("");
  const walls: number[] = [];
  const cellsByLetter = new Map<string, number[]>();
  [...grid].forEach((character, cell) => {
    if (character === WALL) {
      walls.push(cell);
    } else if (character !== EMPTY) {
      cellsByLetter.set(character, [
        ...(cellsByLetter.get(character) ?? []),
        cell,
      ]);
    }
  });
  const pieces: HakoiriMusumePiece[] = [];
  for (const [letter, cells] of cellsByLetter) {
    const target = targetLetters.indexOf(letter as "A" | "B");
    if (target === -1 && !pieceLetters.includes(letter)) {
      return null;
    }
    const found = findKindOfCells(size, cells);
    if (!found) {
      return null;
    }
    pieces.push({
      kind: found.kind,
      cell: found.anchor,
      target: target === -1 ? null : target,
    });
  }
  const goals = goalTexts.map((goalText) => parseGoal(size, goalText));
  if (goals.includes(null)) {
    return null;
  }
  return {
    layout: { ...size, walls, goals: goals as HakoiriMusumeGoal[] },
    pieces,
  };
}

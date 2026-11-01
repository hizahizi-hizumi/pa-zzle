/**
 * 一辺 `size` の正方形の枠に置いた盤面。マス番号は枠の行優先（`row * size + column`）。
 * - `holes`: 穴の番号。穴は盤面に無いマスで、道は通れず、通らなくてよい。外周の穴は盤面の外形を欠く。昇順で重複しない。
 * - `start`: 道の始点のマス。
 */
export type HitofudePuzzleBoard = {
  size: number;
  holes: readonly number[];
  start: number;
};

/** 矢印キーなどで先端から進む向き。並びは隣のマスを列挙する順でもある。 */
export const hitofudePuzzleDirections = [
  "up",
  "right",
  "down",
  "left",
] as const;

export type HitofudePuzzleDirection = (typeof hitofudePuzzleDirections)[number];

const directionOffsets = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const satisfies Record<
  HitofudePuzzleDirection,
  { row: number; column: number }
>;

export type HitofudePuzzleCellPosition = { row: number; column: number };

export function getHitofudePuzzleCellPosition(
  size: number,
  cell: number,
): HitofudePuzzleCellPosition {
  return { row: Math.floor(cell / size), column: cell % size };
}

/** 枠の中のマス番号か。穴も枠の中にある。 */
export function isHitofudePuzzleCellOnBoard(
  size: number,
  cell: number,
): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < size * size;
}

/** `cell` から `direction` の向きに隣り合うマス。枠の外なら `null`。 */
export function getHitofudePuzzleNeighborCell(
  size: number,
  cell: number,
  direction: HitofudePuzzleDirection,
): number | null {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  const offset = directionOffsets[direction];
  const nextRow = row + offset.row;
  const nextColumn = column + offset.column;
  if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size) {
    return null;
  }
  return nextRow * size + nextColumn;
}

/** 穴を考えない、枠の中で上下左右に隣り合うマス。並びは `hitofudePuzzleDirections` に従う。 */
export function listHitofudePuzzleGridNeighbors(
  size: number,
  cell: number,
): number[] {
  return hitofudePuzzleDirections.flatMap(function neighborToward(direction) {
    const neighbor = getHitofudePuzzleNeighborCell(size, cell, direction);
    return neighbor === null ? [] : [neighbor];
  });
}

/** `from` から見て、上下左右に隣り合う `to` がある向き。隣り合わなければ `null`。 */
export function findHitofudePuzzleDirection(
  size: number,
  from: number,
  to: number,
): HitofudePuzzleDirection | null {
  return (
    hitofudePuzzleDirections.find(
      (direction) =>
        getHitofudePuzzleNeighborCell(size, from, direction) === to,
    ) ?? null
  );
}

export function areHitofudePuzzleCellsAdjacent(
  size: number,
  left: number,
  right: number,
): boolean {
  return listHitofudePuzzleGridNeighbors(size, left).includes(right);
}

export function isHitofudePuzzleHole(
  board: HitofudePuzzleBoard,
  cell: number,
): boolean {
  return board.holes.includes(cell);
}

/** 枠の全マスの番号。穴を含む。 */
export function listHitofudePuzzleCells(size: number): number[] {
  return Array.from({ length: size * size }, (_, cell) => cell);
}

/** 穴でない、道が通るマスの番号。 */
export function listHitofudePuzzleOpenCells(
  board: HitofudePuzzleBoard,
): number[] {
  const holes = new Set(board.holes);
  return listHitofudePuzzleCells(board.size).filter((cell) => !holes.has(cell));
}

/**
 * マスごとの、道が次に進める隣のマス（上下左右に隣り合う、穴でないマス）。
 * 穴の項は空。隣の並びは `hitofudePuzzleDirections` に従う。
 */
export function createHitofudePuzzleAdjacency(
  board: HitofudePuzzleBoard,
): readonly (readonly number[])[] {
  const holes = new Set(board.holes);
  return Array.from(
    { length: board.size * board.size },
    function passableNeighbors(_, cell) {
      if (holes.has(cell)) {
        return [];
      }
      return listHitofudePuzzleGridNeighbors(board.size, cell).filter(
        (neighbor) => !holes.has(neighbor),
      );
    },
  );
}

function isStrictlyIncreasing(values: readonly number[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1]! < value,
  );
}

export function assertHitofudePuzzleBoard(board: HitofudePuzzleBoard): void {
  const { size, holes, start } = board;
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(
      "Hitofude puzzle board size must be a positive integer",
    );
  }
  if (
    !holes.every((cell) => isHitofudePuzzleCellOnBoard(size, cell)) ||
    !isStrictlyIncreasing(holes)
  ) {
    throw new RangeError(
      "Hitofude puzzle holes must be ascending distinct cells on the board",
    );
  }
  if (!isHitofudePuzzleCellOnBoard(size, start) || holes.includes(start)) {
    throw new RangeError("Hitofude puzzle start must not be a hole");
  }
}

const cellNotation = { open: ".", hole: "#", start: "S" } as const;
const cellSeparator = " ";

/**
 * 盤面を記法の行で表す。固定問題・テスト・同型の正規化キーで盤面を読みやすく書くための記法。
 * 1行が枠の1行で、マスを空白で区切って書く（`.` 道が通るマス、`#` 穴、`S` 始点）。
 * 例: 2×2 で左上が始点、右下が穴 → `["S .", ". #"]`。
 */
export function formatHitofudePuzzleBoard(
  board: HitofudePuzzleBoard,
): string[] {
  const { size } = board;
  const holes = new Set(board.holes);
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      const cell = row * size + column;
      return cell === board.start
        ? cellNotation.start
        : holes.has(cell)
          ? cellNotation.hole
          : cellNotation.open;
    }).join(cellSeparator),
  );
}

/** `formatHitofudePuzzleBoard` の記法から盤面を作る。 */
export function parseHitofudePuzzleBoard(
  rows: readonly string[],
): HitofudePuzzleBoard {
  const size = rows.length;
  const holes: number[] = [];
  let start: number | null = null;

  for (const [row, line] of rows.entries()) {
    const notations = line.split(cellSeparator);
    if (notations.length !== size) {
      throw new RangeError(
        `Hitofude puzzle notation row must have ${size} cells: ${line}`,
      );
    }
    for (const [column, notation] of notations.entries()) {
      const cell = row * size + column;
      if (notation === cellNotation.hole) {
        holes.push(cell);
      } else if (notation === cellNotation.start) {
        if (start !== null) {
          throw new RangeError("Hitofude puzzle notation must have one start");
        }
        start = cell;
      } else if (notation !== cellNotation.open) {
        throw new RangeError(
          `Unknown Hitofude puzzle cell notation: ${notation}`,
        );
      }
    }
  }
  if (start === null) {
    throw new RangeError("Hitofude puzzle notation must have a start");
  }
  const board = { size, holes, start };
  assertHitofudePuzzleBoard(board);
  return board;
}

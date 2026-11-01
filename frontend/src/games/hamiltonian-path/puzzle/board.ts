/**
 * 一辺 `size` の正方形の枠に置いた盤面。マス番号は枠の行優先（`row * size + column`）。
 * - `holes`: 穴の番号。穴は盤面に無いマスで、道は通れず、通らなくてよい。外周の穴は盤面の外形を欠く。昇順で重複しない。
 * - `start`: 道の始点のマス。
 */
export type HamiltonianPathBoard = {
  size: number;
  holes: readonly number[];
  start: number;
};

/** 矢印キーなどで先端から進む向き。並びは隣のマスを列挙する順でもある。 */
export const hamiltonianPathDirections = [
  "up",
  "right",
  "down",
  "left",
] as const;

export type HamiltonianPathDirection =
  (typeof hamiltonianPathDirections)[number];

const directionOffsets = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const satisfies Record<
  HamiltonianPathDirection,
  { row: number; column: number }
>;

export type HamiltonianPathCellPosition = { row: number; column: number };

export function getHamiltonianPathCellPosition(
  size: number,
  cell: number,
): HamiltonianPathCellPosition {
  return { row: Math.floor(cell / size), column: cell % size };
}

/** 枠の中のマス番号か。穴も枠の中にある。 */
export function isHamiltonianPathCellOnBoard(
  size: number,
  cell: number,
): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < size * size;
}

/** `cell` から `direction` の向きに隣り合うマス。枠の外なら `null`。 */
export function getHamiltonianPathNeighborCell(
  size: number,
  cell: number,
  direction: HamiltonianPathDirection,
): number | null {
  const { row, column } = getHamiltonianPathCellPosition(size, cell);
  const offset = directionOffsets[direction];
  const nextRow = row + offset.row;
  const nextColumn = column + offset.column;
  if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size) {
    return null;
  }
  return nextRow * size + nextColumn;
}

/** 穴を考えない、枠の中で上下左右に隣り合うマス。並びは `hamiltonianPathDirections` に従う。 */
export function listHamiltonianPathGridNeighbors(
  size: number,
  cell: number,
): number[] {
  return hamiltonianPathDirections.flatMap(function neighborToward(direction) {
    const neighbor = getHamiltonianPathNeighborCell(size, cell, direction);
    return neighbor === null ? [] : [neighbor];
  });
}

/** `from` から見て、上下左右に隣り合う `to` がある向き。隣り合わなければ `null`。 */
export function findHamiltonianPathDirection(
  size: number,
  from: number,
  to: number,
): HamiltonianPathDirection | null {
  return (
    hamiltonianPathDirections.find(
      (direction) =>
        getHamiltonianPathNeighborCell(size, from, direction) === to,
    ) ?? null
  );
}

export function areHamiltonianPathCellsAdjacent(
  size: number,
  left: number,
  right: number,
): boolean {
  return listHamiltonianPathGridNeighbors(size, left).includes(right);
}

export function isHamiltonianPathHole(
  board: HamiltonianPathBoard,
  cell: number,
): boolean {
  return board.holes.includes(cell);
}

/** 枠の全マスの番号。穴を含む。 */
export function listHamiltonianPathCells(size: number): number[] {
  return Array.from({ length: size * size }, (_, cell) => cell);
}

/** 穴でない、道が通るマスの番号。 */
export function listHamiltonianPathOpenCells(
  board: HamiltonianPathBoard,
): number[] {
  const holes = new Set(board.holes);
  return listHamiltonianPathCells(board.size).filter(
    (cell) => !holes.has(cell),
  );
}

/**
 * マスごとの、道が次に進める隣のマス（上下左右に隣り合う、穴でないマス）。
 * 穴の項は空。隣の並びは `hamiltonianPathDirections` に従う。
 */
export function createHamiltonianPathAdjacency(
  board: HamiltonianPathBoard,
): readonly (readonly number[])[] {
  const holes = new Set(board.holes);
  return Array.from(
    { length: board.size * board.size },
    function passableNeighbors(_, cell) {
      if (holes.has(cell)) {
        return [];
      }
      return listHamiltonianPathGridNeighbors(board.size, cell).filter(
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

export function assertHamiltonianPathBoard(board: HamiltonianPathBoard): void {
  const { size, holes, start } = board;
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(
      "Hamiltonian path board size must be a positive integer",
    );
  }
  if (
    !holes.every((cell) => isHamiltonianPathCellOnBoard(size, cell)) ||
    !isStrictlyIncreasing(holes)
  ) {
    throw new RangeError(
      "Hamiltonian path holes must be ascending distinct cells on the board",
    );
  }
  if (!isHamiltonianPathCellOnBoard(size, start) || holes.includes(start)) {
    throw new RangeError("Hamiltonian path start must not be a hole");
  }
}

const cellNotation = { open: ".", hole: "#", start: "S" } as const;
const cellSeparator = " ";

/**
 * 盤面を記法の行で表す。固定問題・テスト・同型の正規化キーで盤面を読みやすく書くための記法。
 * 1行が枠の1行で、マスを空白で区切って書く（`.` 道が通るマス、`#` 穴、`S` 始点）。
 * 例: 2×2 で左上が始点、右下が穴 → `["S .", ". #"]`。
 */
export function formatHamiltonianPathBoard(
  board: HamiltonianPathBoard,
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

/** `formatHamiltonianPathBoard` の記法から盤面を作る。 */
export function parseHamiltonianPathBoard(
  rows: readonly string[],
): HamiltonianPathBoard {
  const size = rows.length;
  const holes: number[] = [];
  let start: number | null = null;

  for (const [row, line] of rows.entries()) {
    const notations = line.split(cellSeparator);
    if (notations.length !== size) {
      throw new RangeError(
        `Hamiltonian path notation row must have ${size} cells: ${line}`,
      );
    }
    for (const [column, notation] of notations.entries()) {
      const cell = row * size + column;
      if (notation === cellNotation.hole) {
        holes.push(cell);
      } else if (notation === cellNotation.start) {
        if (start !== null) {
          throw new RangeError("Hamiltonian path notation must have one start");
        }
        start = cell;
      } else if (notation !== cellNotation.open) {
        throw new RangeError(
          `Unknown Hamiltonian path cell notation: ${notation}`,
        );
      }
    }
  }
  if (start === null) {
    throw new RangeError("Hamiltonian path notation must have a start");
  }
  const board = { size, holes, start };
  assertHamiltonianPathBoard(board);
  return board;
}

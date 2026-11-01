/**
 * 隣り合う2つの有効マスの間にある仕切り。道はこの2マスの間を通れない。
 * マス番号は行優先で、小さい方を先に置く。
 */
export type HamiltonianPathPartition = readonly [number, number];

/**
 * 一辺 `size` の正方形盤面。マス番号は行優先（`row * size + column`）。
 * - `walls`: 壁マスの番号。昇順で重複しない。
 * - `partitions`: 仕切り。マス番号の組の昇順で重複しない。
 * - `start`: 道の始点のマス。
 */
export type HamiltonianPathBoard = {
  size: number;
  walls: readonly number[];
  partitions: readonly HamiltonianPathPartition[];
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

export function isHamiltonianPathCellOnBoard(
  size: number,
  cell: number,
): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < size * size;
}

/** `cell` から `direction` の向きに隣り合うマス。盤面の外なら `null`。 */
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

/** 壁・仕切りを考えない、上下左右に隣り合うマス。並びは `hamiltonianPathDirections` に従う。 */
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

export function createHamiltonianPathPartition(
  left: number,
  right: number,
): HamiltonianPathPartition {
  return left < right ? [left, right] : [right, left];
}

function comparePartitions(
  left: HamiltonianPathPartition,
  right: HamiltonianPathPartition,
): number {
  return left[0] - right[0] || left[1] - right[1];
}

/** 仕切りを盤面の決まった並び（マス番号の組の昇順・重複なし）にする。 */
export function normalizeHamiltonianPathPartitions(
  partitions: Iterable<HamiltonianPathPartition>,
): HamiltonianPathPartition[] {
  const sorted = Array.from(partitions, function normalize([left, right]) {
    return createHamiltonianPathPartition(left, right);
  }).sort(comparePartitions);
  return sorted.filter(function isFirstOccurrence(partition, index) {
    const previous = sorted[index - 1];
    return (
      previous === undefined || comparePartitions(previous, partition) !== 0
    );
  });
}

function partitionKey(left: number, right: number): string {
  return createHamiltonianPathPartition(left, right).join("-");
}

export function hasHamiltonianPathPartition(
  board: HamiltonianPathBoard,
  left: number,
  right: number,
): boolean {
  const key = partitionKey(left, right);
  return board.partitions.some(
    (partition) => partitionKey(partition[0], partition[1]) === key,
  );
}

export function isHamiltonianPathWall(
  board: HamiltonianPathBoard,
  cell: number,
): boolean {
  return board.walls.includes(cell);
}

/** 盤面の全マスの番号。壁マスを含む。 */
export function listHamiltonianPathCells(size: number): number[] {
  return Array.from({ length: size * size }, (_, cell) => cell);
}

export function listHamiltonianPathOpenCells(
  board: HamiltonianPathBoard,
): number[] {
  const walls = new Set(board.walls);
  return listHamiltonianPathCells(board.size).filter(
    (cell) => !walls.has(cell),
  );
}

/**
 * マスごとの、道が次に進める隣のマス（有効マスで、間に仕切りがない）。
 * 壁マスの項は空。隣の並びは `hamiltonianPathDirections` に従う。
 */
export function createHamiltonianPathAdjacency(
  board: HamiltonianPathBoard,
): readonly (readonly number[])[] {
  const walls = new Set(board.walls);
  const partitions = new Set(
    board.partitions.map(([left, right]) => partitionKey(left, right)),
  );
  return Array.from(
    { length: board.size * board.size },
    function passableNeighbors(_, cell) {
      if (walls.has(cell)) {
        return [];
      }
      return listHamiltonianPathGridNeighbors(board.size, cell).filter(
        (neighbor) =>
          !walls.has(neighbor) && !partitions.has(partitionKey(cell, neighbor)),
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
  const { size, walls, partitions, start } = board;
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(
      "Hamiltonian path board size must be a positive integer",
    );
  }
  if (
    !walls.every((cell) => isHamiltonianPathCellOnBoard(size, cell)) ||
    !isStrictlyIncreasing(walls)
  ) {
    throw new RangeError(
      "Hamiltonian path walls must be ascending distinct cells on the board",
    );
  }
  if (!isHamiltonianPathCellOnBoard(size, start) || walls.includes(start)) {
    throw new RangeError("Hamiltonian path start must be an open cell");
  }
  for (const [left, right] of partitions) {
    if (
      !isHamiltonianPathCellOnBoard(size, left) ||
      !isHamiltonianPathCellOnBoard(size, right) ||
      left >= right ||
      !areHamiltonianPathCellsAdjacent(size, left, right) ||
      walls.includes(left) ||
      walls.includes(right)
    ) {
      throw new RangeError(
        "Hamiltonian path partitions must separate two adjacent open cells",
      );
    }
  }
  const normalized = normalizeHamiltonianPathPartitions(partitions);
  if (
    normalized.length !== partitions.length ||
    normalized.some(
      (partition, index) =>
        comparePartitions(partition, partitions[index]!) !== 0,
    )
  ) {
    throw new RangeError(
      "Hamiltonian path partitions must be ascending and distinct",
    );
  }
}

const cellNotation = { open: ".", wall: "#", start: "S" } as const;
const verticalPartitionNotation = "|";
const horizontalPartitionNotation = "-";

/**
 * 盤面を記法の行で表す。固定問題・テスト・同型の正規化キーで盤面を読みやすく書くための記法。
 * 偶数行がマスの行で、偶数列にマス（`.` 有効マス、`#` 壁マス、`S` 始点）、奇数列に左右のマスの間の仕切り `|` を書く。
 * 奇数行は上下のマスの間の行で、偶数列に仕切り `-` を書く。仕切りのない所は空白。
 * 例: 2×2 で左上が始点、右下が壁、左の2マスの間に仕切り → `["S .", "-  ", ". #"]`。
 */
export function formatHamiltonianPathBoard(
  board: HamiltonianPathBoard,
): string[] {
  const { size } = board;
  const walls = new Set(board.walls);
  const rows: string[] = [];
  for (let row = 0; row < size; row += 1) {
    const cellRow: string[] = [];
    const partitionRow: string[] = [];
    for (let column = 0; column < size; column += 1) {
      const cell = row * size + column;
      cellRow.push(
        cell === board.start
          ? cellNotation.start
          : walls.has(cell)
            ? cellNotation.wall
            : cellNotation.open,
      );
      partitionRow.push(
        row + 1 < size && hasHamiltonianPathPartition(board, cell, cell + size)
          ? horizontalPartitionNotation
          : " ",
      );
      if (column + 1 < size) {
        cellRow.push(
          hasHamiltonianPathPartition(board, cell, cell + 1)
            ? verticalPartitionNotation
            : " ",
        );
        partitionRow.push(" ");
      }
    }
    rows.push(cellRow.join(""));
    if (row + 1 < size) {
      rows.push(partitionRow.join(""));
    }
  }
  return rows;
}

/** `formatHamiltonianPathBoard` の記法から盤面を作る。行末の空白は省いてよい。 */
export function parseHamiltonianPathBoard(
  rows: readonly string[],
): HamiltonianPathBoard {
  if (rows.length % 2 === 0) {
    throw new RangeError(
      "Hamiltonian path notation must alternate cell rows and partition rows",
    );
  }
  const size = (rows.length + 1) / 2;
  const width = size * 2 - 1;
  const walls: number[] = [];
  const partitions: HamiltonianPathPartition[] = [];
  let start: number | null = null;

  for (const [lineIndex, line] of rows.entries()) {
    if (line.length > width) {
      throw new RangeError(
        `Hamiltonian path notation row is too long: ${line}`,
      );
    }
    const padded = line.padEnd(width, " ");
    const row = Math.floor(lineIndex / 2);
    const isCellRow = lineIndex % 2 === 0;
    for (const [position, notation] of Array.from(padded).entries()) {
      const column = Math.floor(position / 2);
      const cell = row * size + column;
      const isCellColumn = position % 2 === 0;
      if (isCellRow && isCellColumn) {
        if (notation === cellNotation.wall) {
          walls.push(cell);
        } else if (notation === cellNotation.start) {
          if (start !== null) {
            throw new RangeError(
              "Hamiltonian path notation must have one start",
            );
          }
          start = cell;
        } else if (notation !== cellNotation.open) {
          throw new RangeError(
            `Unknown Hamiltonian path cell notation: ${notation}`,
          );
        }
      } else if (isCellRow && notation === verticalPartitionNotation) {
        partitions.push([cell, cell + 1]);
      } else if (
        !isCellRow &&
        isCellColumn &&
        notation === horizontalPartitionNotation
      ) {
        partitions.push([cell, cell + size]);
      } else if (notation !== " ") {
        throw new RangeError(
          `Unexpected Hamiltonian path notation: ${notation}`,
        );
      }
    }
  }
  if (start === null) {
    throw new RangeError("Hamiltonian path notation must have a start");
  }
  const board = {
    size,
    walls,
    partitions: normalizeHamiltonianPathPartitions(partitions),
    start,
  };
  assertHamiltonianPathBoard(board);
  return board;
}

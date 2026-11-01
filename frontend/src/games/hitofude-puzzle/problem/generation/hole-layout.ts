import {
  getHamiltonianPathCellPosition,
  type HamiltonianPathBoard,
  listHamiltonianPathGridNeighbors,
} from "@/games/hamiltonian-path/puzzle/board";

/**
 * 穴の散らばり方の指標。問題を「穴が適度に散らばった盤面」に保つ見た目の基準（`hamiltonianPathHoleLayoutCriteria`）に使う。
 * - `holeCount`: 穴の数。
 * - `largestHoleClusterSize`: 上下左右につながった穴の塊のうち、最も大きい塊のマスの数。穴が無ければ0。
 * - `quadrantsWithHolesCount`: 枠を上下左右に四分割した区画のうち、穴のある区画の数。奇数の一辺の中央の行・列は両側の区画に数える。
 * - `openBlockRatio`: 枠の中の 2×2 のブロックのうち、4マスとも穴でないブロックの割合。
 */
export type HamiltonianPathHoleLayout = {
  holeCount: number;
  largestHoleClusterSize: number;
  quadrantsWithHolesCount: number;
  openBlockRatio: number;
};

/**
 * 見た目の基準。穴が少なすぎて長方形の盤面に近づくこと、大きな空白・片寄り、通路だらけの盤面を避ける。
 * - `holeRatio`: 枠のマスのうち穴の割合の範囲（5×5 は 2〜6、8×8 は 6〜16 個）。
 * - `maximumHoleClusterSize`: つながった穴の塊の大きさの上限。
 * - `minimumQuadrantsWithHoles`: 穴が `quadrantRuleMinimumHoleCount` 個以上あるときに、穴のある区画の数の下限。
 * - `minimumOpenBlockRatio`: 4マスとも穴でない 2×2 のブロックの割合の下限。
 */
export const hamiltonianPathHoleLayoutCriteria = {
  holeRatio: { minimum: 0.08, maximum: 0.25 },
  maximumHoleClusterSize: 3,
  quadrantRuleMinimumHoleCount: 4,
  minimumQuadrantsWithHoles: 3,
  minimumOpenBlockRatio: 0.35,
} as const;

/**
 * 2×2 のブロックの割合の不足を違反の量に直す倍率。割合の 0.05 の不足を違反1つと数える。
 */
const OPEN_BLOCK_SHORTAGE_SCALE = 20;

function measureLargestHoleClusterSize(board: HamiltonianPathBoard): number {
  const holes = new Set(board.holes);
  const reached = new Set<number>();
  let largest = 0;
  for (const hole of board.holes) {
    if (reached.has(hole)) {
      continue;
    }
    reached.add(hole);
    const pending = [hole];
    let clusterSize = 0;
    for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
      clusterSize += 1;
      for (const neighbor of listHamiltonianPathGridNeighbors(
        board.size,
        cell,
      )) {
        if (holes.has(neighbor) && !reached.has(neighbor)) {
          reached.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    largest = Math.max(largest, clusterSize);
  }
  return largest;
}

/** 行か列の位置が、四分割のどちらの半分にあるか。奇数の一辺の中央は両方。 */
function listHalves(size: number, position: number): number[] {
  const middle = size / 2 - 0.5;
  return position < middle ? [0] : position > middle ? [1] : [0, 1];
}

function countQuadrantsWithHoles(board: HamiltonianPathBoard): number {
  const quadrants = new Set<number>();
  for (const hole of board.holes) {
    const { row, column } = getHamiltonianPathCellPosition(board.size, hole);
    for (const rowHalf of listHalves(board.size, row)) {
      for (const columnHalf of listHalves(board.size, column)) {
        quadrants.add(rowHalf * 2 + columnHalf);
      }
    }
  }
  return quadrants.size;
}

function measureOpenBlockRatio(board: HamiltonianPathBoard): number {
  const { size } = board;
  const holes = new Set(board.holes);
  let openBlockCount = 0;
  for (let row = 0; row + 1 < size; row += 1) {
    for (let column = 0; column + 1 < size; column += 1) {
      const topLeft = row * size + column;
      const block = [topLeft, topLeft + 1, topLeft + size, topLeft + size + 1];
      openBlockCount += block.some((cell) => holes.has(cell)) ? 0 : 1;
    }
  }
  return openBlockCount / (size - 1) ** 2;
}

export function measureHamiltonianPathHoleLayout(
  board: HamiltonianPathBoard,
): HamiltonianPathHoleLayout {
  return {
    holeCount: board.holes.length,
    largestHoleClusterSize: measureLargestHoleClusterSize(board),
    quadrantsWithHolesCount: countQuadrantsWithHoles(board),
    openBlockRatio: measureOpenBlockRatio(board),
  };
}

/**
 * 見た目の基準から外れた量。0 なら基準を満たす。生成器はこれを解の数と合わせて減らす。
 * 穴の数の過不足・塊の超過・穴のある区画の不足はその個数を、2×2 のブロックの割合の不足は
 * `OPEN_BLOCK_SHORTAGE_SCALE` 倍して切り上げた値を足す。
 */
export function countHamiltonianPathHoleLayoutViolations(
  board: HamiltonianPathBoard,
): number {
  const criteria = hamiltonianPathHoleLayoutCriteria;
  const layout = measureHamiltonianPathHoleLayout(board);
  const cellCount = board.size * board.size;
  const minimumHoleCount = Math.ceil(criteria.holeRatio.minimum * cellCount);
  const maximumHoleCount = Math.floor(criteria.holeRatio.maximum * cellCount);
  let violations =
    Math.max(0, minimumHoleCount - layout.holeCount) +
    Math.max(0, layout.holeCount - maximumHoleCount) +
    Math.max(
      0,
      layout.largestHoleClusterSize - criteria.maximumHoleClusterSize,
    );
  if (layout.holeCount >= criteria.quadrantRuleMinimumHoleCount) {
    violations += Math.max(
      0,
      criteria.minimumQuadrantsWithHoles - layout.quadrantsWithHolesCount,
    );
  }
  if (layout.openBlockRatio < criteria.minimumOpenBlockRatio) {
    violations += Math.ceil(
      (criteria.minimumOpenBlockRatio - layout.openBlockRatio) *
        OPEN_BLOCK_SHORTAGE_SCALE,
    );
  }
  return violations;
}

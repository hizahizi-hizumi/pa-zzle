import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleGridNeighbors,
} from "@/games/hitofude-puzzle/puzzle/board";

/** 穴の散らばり方の指標。問題を「穴が適度に散らばった盤面」に保つ見た目の基準（`hitofudePuzzleHoleLayoutCriteria`）に使う。 */
export type HitofudePuzzleHoleLayout = {
  holeCount: number;
  /** 上下左右につながった穴の塊のうち、最も大きい塊のマスの数。穴が無ければ0。 */
  largestHoleClusterSize: number;
  /** 枠を上下左右に四分割した区画のうち、穴のある区画の数。奇数の一辺の中央の行・列は両側の区画に数える。 */
  quadrantsWithHolesCount: number;
  /** 枠の中の 2×2 のブロックのうち、4マスとも穴でないブロックの割合。 */
  openBlockRatio: number;
};

export const hitofudePuzzleHoleLayoutCriteria = {
  // 枠のマスのうち穴の割合の範囲（5×5 は 2〜6、8×8 は 6〜16 個）。
  holeRatio: { minimum: 0.08, maximum: 0.25 },
  maximumHoleClusterSize: 3,
  quadrantRuleMinimumHoleCount: 4,
  // 穴が `quadrantRuleMinimumHoleCount` 個以上あるときに、穴のある区画の数の下限。
  minimumQuadrantsWithHoles: 3,
  // 4マスとも穴でない 2×2 のブロックの割合の下限。
  minimumOpenBlockRatio: 0.35,
} as const;

/**
 * 2×2 のブロックの割合の不足を違反の量に直す倍率。割合の 0.05 の不足を違反1つと数える。
 */
const OPEN_BLOCK_SHORTAGE_SCALE = 20;

function measureLargestHoleClusterSize(board: HitofudePuzzleBoard): number {
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
      for (const neighbor of listHitofudePuzzleGridNeighbors(
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

function listHalves(size: number, position: number): number[] {
  const middle = size / 2 - 0.5;
  return position < middle ? [0] : position > middle ? [1] : [0, 1];
}

function countQuadrantsWithHoles(board: HitofudePuzzleBoard): number {
  const quadrants = new Set<number>();
  for (const hole of board.holes) {
    const { row, column } = getHitofudePuzzleCellPosition(board.size, hole);
    for (const rowHalf of listHalves(board.size, row)) {
      for (const columnHalf of listHalves(board.size, column)) {
        quadrants.add(rowHalf * 2 + columnHalf);
      }
    }
  }
  return quadrants.size;
}

function measureOpenBlockRatio(board: HitofudePuzzleBoard): number {
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

export function measureHitofudePuzzleHoleLayout(
  board: HitofudePuzzleBoard,
): HitofudePuzzleHoleLayout {
  return {
    holeCount: board.holes.length,
    largestHoleClusterSize: measureLargestHoleClusterSize(board),
    quadrantsWithHolesCount: countQuadrantsWithHoles(board),
    openBlockRatio: measureOpenBlockRatio(board),
  };
}

export function countHitofudePuzzleHoleLayoutViolations(
  board: HitofudePuzzleBoard,
): number {
  const criteria = hitofudePuzzleHoleLayoutCriteria;
  const layout = measureHitofudePuzzleHoleLayout(board);
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

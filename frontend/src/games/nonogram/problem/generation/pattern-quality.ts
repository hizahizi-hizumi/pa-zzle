import { listNonogramLines } from "@/games/nonogram/puzzle/board";
import {
  getNonogramPatternLine,
  type NonogramPattern,
} from "@/games/nonogram/puzzle/pattern";

/**
 * 図柄の見た目の量。
 * - `blackRatio`: 黒マスの割合。
 * - `blankRowCount` / `blankColumnCount`: 黒の無い行・列の数。
 * - `isolatedBlackRatio`: 上下左右に黒の無い黒マスが、黒マスに占める割合。黒が無ければ 0。
 * - `blackComponentCount`: 上下左右でつながる黒の塊の数。
 * - `mirrorSymmetric`: 左右対称か。
 */
export type NonogramPatternQuality = {
  blackRatio: number;
  blankRowCount: number;
  blankColumnCount: number;
  isolatedBlackRatio: number;
  blackComponentCount: number;
  mirrorSymmetric: boolean;
};

/**
 * 問題にする図柄の条件。黒が少なすぎ・多すぎる図柄、ヒントが0の行・列が続く図柄、
 * ばらばらの黒が目立つ図柄を除き、塊のまとまった図柄を残す。
 * 条件は図柄の見た目と候補の供給を動かし、難易度の分布はほとんど変えない。
 * - `minimumBlackRatio` / `maximumBlackRatio`: 黒マスの割合の下限と上限（どちらも含む）。
 * - `maximumBlankLineCount`: 黒の無い行・列の数（縦横合わせて）の上限。
 */
export const nonogramPatternRequirements = {
  minimumBlackRatio: 0.35,
  maximumBlackRatio: 0.72,
  maximumBlankLineCount: 1,
  maximumIsolatedBlackRatio: 0.12,
} as const satisfies Record<string, number>;

const orthogonalSteps = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function listOrthogonalBlackNeighbors(
  pattern: NonogramPattern,
  cellIndex: number,
): number[] {
  const { width, height, black } = pattern;
  const row = Math.floor(cellIndex / width);
  const column = cellIndex % width;
  return orthogonalSteps.flatMap(function neighbor([rowStep, columnStep]) {
    const neighborRow = row + rowStep;
    const neighborColumn = column + columnStep;
    const neighborIndex = neighborRow * width + neighborColumn;
    return neighborRow >= 0 &&
      neighborRow < height &&
      neighborColumn >= 0 &&
      neighborColumn < width &&
      black[neighborIndex]
      ? [neighborIndex]
      : [];
  });
}

function countBlackComponents(pattern: NonogramPattern): number {
  const visited = new Set<number>();
  let componentCount = 0;
  for (const [cellIndex, isBlack] of pattern.black.entries()) {
    if (!isBlack || visited.has(cellIndex)) {
      continue;
    }
    componentCount += 1;
    const stack = [cellIndex];
    visited.add(cellIndex);
    for (
      let current = stack.pop();
      current !== undefined;
      current = stack.pop()
    ) {
      for (const neighborIndex of listOrthogonalBlackNeighbors(
        pattern,
        current,
      )) {
        if (!visited.has(neighborIndex)) {
          visited.add(neighborIndex);
          stack.push(neighborIndex);
        }
      }
    }
  }
  return componentCount;
}

export function measureNonogramPatternQuality(
  pattern: NonogramPattern,
): NonogramPatternQuality {
  const blackCellIndices = pattern.black.flatMap((isBlack, cellIndex) =>
    isBlack ? [cellIndex] : [],
  );
  const isolatedBlackCount = blackCellIndices.filter(
    (cellIndex) =>
      listOrthogonalBlackNeighbors(pattern, cellIndex).length === 0,
  ).length;
  let blankRowCount = 0;
  let blankColumnCount = 0;
  let mirrorSymmetric = true;
  for (const line of listNonogramLines(pattern)) {
    const cells = getNonogramPatternLine(pattern, line);
    const blank = !cells.includes(true);
    if (line.axis === "row") {
      blankRowCount += blank ? 1 : 0;
      mirrorSymmetric &&= cells.every(
        (isBlack, column) => isBlack === cells[cells.length - 1 - column],
      );
    } else {
      blankColumnCount += blank ? 1 : 0;
    }
  }
  return {
    blackRatio: blackCellIndices.length / (pattern.width * pattern.height),
    blankRowCount,
    blankColumnCount,
    isolatedBlackRatio:
      blackCellIndices.length === 0
        ? 0
        : isolatedBlackCount / blackCellIndices.length,
    blackComponentCount: countBlackComponents(pattern),
    mirrorSymmetric,
  };
}

export function meetsNonogramPatternRequirements(
  quality: NonogramPatternQuality,
): boolean {
  return (
    nonogramPatternRequirements.minimumBlackRatio <= quality.blackRatio &&
    quality.blackRatio <= nonogramPatternRequirements.maximumBlackRatio &&
    quality.blankRowCount + quality.blankColumnCount <=
      nonogramPatternRequirements.maximumBlankLineCount &&
    quality.isolatedBlackRatio <=
      nonogramPatternRequirements.maximumIsolatedBlackRatio
  );
}

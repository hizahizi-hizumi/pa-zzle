import type { NonogramPatternStyle } from "@/games/nonogram/problem/problem";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";
import type { ProblemRandom } from "@/games/problem-seed";

/**
 * 各マスを、周り8マスと自身の9マス（盤面の端では盤面内のマスだけ）の多数決で塗り直す。
 * 黒と白が同数なら元のまま残す。
 */
function smoothNonogramPattern(pattern: NonogramPattern): NonogramPattern {
  const { width, height, black } = pattern;
  const smoothed = black.map(function smoothCell(isBlack, cellIndex) {
    const row = Math.floor(cellIndex / width);
    const column = cellIndex % width;
    let blackCount = 0;
    let cellCount = 0;
    for (let neighborRow = row - 1; neighborRow <= row + 1; neighborRow += 1) {
      for (
        let neighborColumn = column - 1;
        neighborColumn <= column + 1;
        neighborColumn += 1
      ) {
        if (
          neighborRow < 0 ||
          neighborRow >= height ||
          neighborColumn < 0 ||
          neighborColumn >= width
        ) {
          continue;
        }
        cellCount += 1;
        if (black[neighborRow * width + neighborColumn]) {
          blackCount += 1;
        }
      }
    }
    if (blackCount * 2 === cellCount) {
      return isBlack;
    }
    return blackCount * 2 > cellCount;
  });
  return { width, height, black: smoothed };
}

/**
 * 図柄の候補を作る。行ごとに左から乱数で黒を置き、左右対称なら左半分（奇数幅は中央の列を含む）を右へ写し、
 * 多数決の平滑化を `smoothingCount` 回かけて塊のまとまりを作る。乱数は左右対称なら左半分のマスの数だけ使う。
 */
export function generateNonogramPatternCandidate(
  size: NonogramGridSize,
  style: NonogramPatternStyle,
  random: ProblemRandom,
): NonogramPattern {
  const { width, height } = size;
  const sampledWidth = style.mirrored ? Math.ceil(width / 2) : width;
  const black: boolean[] = [];
  for (let row = 0; row < height; row += 1) {
    const sampled = Array.from(
      { length: sampledWidth },
      () => random() < style.blackProbability,
    );
    const mirroredPart = sampled.slice(0, width - sampledWidth).reverse();
    black.push(...sampled, ...mirroredPart);
  }

  let pattern: NonogramPattern = { width, height, black };
  for (let pass = 0; pass < style.smoothingCount; pass += 1) {
    pattern = smoothNonogramPattern(pattern);
  }
  return pattern;
}

export const _private = { smoothNonogramPattern };

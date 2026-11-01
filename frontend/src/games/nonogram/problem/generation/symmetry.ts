import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";

type CellSource = (row: number, column: number) => boolean;

/**
 * 図柄を回転・反転した各向きの、マスの読み方。最初が元の向き。
 * 縦長の盤面は90度回すと別の大きさになるので、上下・左右の反転と180度の回転だけを含める。
 */
function listSymmetricCellSources(pattern: NonogramPattern): CellSource[] {
  const { width, height, black } = pattern;
  function isBlackAt(row: number, column: number): boolean {
    return black[row * width + column] === true;
  }
  const lastRow = height - 1;
  const lastColumn = width - 1;
  const sources: CellSource[] = [
    isBlackAt,
    (row, column) => isBlackAt(row, lastColumn - column),
    (row, column) => isBlackAt(lastRow - row, column),
    (row, column) => isBlackAt(lastRow - row, lastColumn - column),
  ];
  if (width === height) {
    sources.push(
      (row, column) => isBlackAt(column, row),
      (row, column) => isBlackAt(lastColumn - column, row),
      (row, column) => isBlackAt(column, lastRow - row),
      (row, column) => isBlackAt(lastColumn - column, lastRow - row),
    );
  }
  return sources;
}

function encodeVariant(
  width: number,
  height: number,
  isBlackAt: CellSource,
): string {
  return Array.from({ length: height }, function encodeRow(_, row) {
    return Array.from({ length: width }, (_, column) =>
      isBlackAt(row, column) ? "1" : "0",
    ).join("");
  }).join("/");
}

/**
 * 回転・反転で重なる図柄に同じ値を返す正規化キー。問題集から同型の図柄を除くのに使う。
 * 縦長の盤面は90度回すと別の大きさになるので、上下・左右の反転と180度の回転だけを同型とみなす。
 * キーは各行を `1`（黒）と `0`（白）の列にして `/` でつなぎ、同型のうち辞書順で最小のもの。
 */
export function getNonogramSymmetryKey(pattern: NonogramPattern): string {
  const { width, height } = pattern;
  return listSymmetricCellSources(pattern)
    .map((isBlackAt) => encodeVariant(width, height, isBlackAt))
    .reduce((smallest, variant) => (variant < smallest ? variant : smallest));
}

/**
 * 問題集で同じ図柄の言い換えとみなす近さ。回転・反転で重ねたときに違うマスの数がこれ以下の図柄どうしは、
 * 解き終えて現れる絵がほとんど同じなので、問題集に並べて持たない。
 */
export const nonogramNearPatternMaximumDistance = 2;

function countBlackCells(pattern: NonogramPattern): number {
  return pattern.black.filter(Boolean).length;
}

function isWithinNearDistance(
  source: CellSource,
  { width, height, black }: NonogramPattern,
): boolean {
  let distance = 0;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (source(row, column) !== black[row * width + column]) {
        distance += 1;
        if (distance > nonogramNearPatternMaximumDistance) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * 2つの図柄が、回転・反転で重ねたときに `nonogramNearPatternMaximumDistance` マス以下しか違わないか。
 * 同型（違いが0）も近いとみなす。大きさの違う図柄は重ならないので近いとみなさない。
 */
export function areNonogramPatternsNear(
  left: NonogramPattern,
  right: NonogramPattern,
): boolean {
  if (left.width !== right.width || left.height !== right.height) {
    return false;
  }
  // 黒の数の差は、どう重ねても違うマスの数を超えないので、差が上限を超えれば重ねずに近くないと決まる。
  if (
    Math.abs(countBlackCells(left) - countBlackCells(right)) >
    nonogramNearPatternMaximumDistance
  ) {
    return false;
  }
  return listSymmetricCellSources(left).some((source) =>
    isWithinNearDistance(source, right),
  );
}

/**
 * 図柄の並びから、近い図柄（`areNonogramPatternsNear`）の組を、並びの位置の組 `[前, 後]` で返す。
 * 組は前の位置の順、前の位置が同じなら後の位置の順に並べる。
 */
export function listNonogramNearPatternPairs(
  patterns: readonly NonogramPattern[],
): [number, number][] {
  // 大きさと黒の数で並べ、大きさが同じで黒の数の差が上限以内の組だけを重ねて比べる。
  const sorted = patterns
    .map((pattern, index) => ({
      pattern,
      index,
      sizeKey: `${pattern.width}x${pattern.height}`,
      blackCount: countBlackCells(pattern),
    }))
    .sort(
      (left, right) =>
        left.sizeKey.localeCompare(right.sizeKey) ||
        left.blackCount - right.blackCount,
    );
  const pairs: [number, number][] = [];
  for (const [position, left] of sorted.entries()) {
    for (
      let rightPosition = position + 1;
      rightPosition < sorted.length;
      rightPosition += 1
    ) {
      const right = sorted[rightPosition]!;
      if (
        right.sizeKey !== left.sizeKey ||
        right.blackCount - left.blackCount > nonogramNearPatternMaximumDistance
      ) {
        break;
      }
      if (areNonogramPatternsNear(left.pattern, right.pattern)) {
        pairs.push([
          Math.min(left.index, right.index),
          Math.max(left.index, right.index),
        ]);
      }
    }
  }
  return pairs.sort(
    ([leftFirst, leftSecond], [rightFirst, rightSecond]) =>
      leftFirst - rightFirst || leftSecond - rightSecond,
  );
}

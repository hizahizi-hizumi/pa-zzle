import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";

type CellSource = (row: number, column: number) => boolean;

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
  const { width, height, black } = pattern;
  function isBlackAt(row: number, column: number): boolean {
    return black[row * width + column] === true;
  }
  const lastRow = height - 1;
  const lastColumn = width - 1;
  const variants = [
    encodeVariant(width, height, isBlackAt),
    encodeVariant(width, height, (row, column) =>
      isBlackAt(row, lastColumn - column),
    ),
    encodeVariant(width, height, (row, column) =>
      isBlackAt(lastRow - row, column),
    ),
    encodeVariant(width, height, (row, column) =>
      isBlackAt(lastRow - row, lastColumn - column),
    ),
  ];
  if (width === height) {
    variants.push(
      encodeVariant(width, height, (row, column) => isBlackAt(column, row)),
      encodeVariant(width, height, (row, column) =>
        isBlackAt(lastColumn - column, row),
      ),
      encodeVariant(width, height, (row, column) =>
        isBlackAt(column, lastRow - row),
      ),
      encodeVariant(width, height, (row, column) =>
        isBlackAt(lastColumn - column, lastRow - row),
      ),
    );
  }
  return variants.reduce((smallest, variant) =>
    variant < smallest ? variant : smallest,
  );
}

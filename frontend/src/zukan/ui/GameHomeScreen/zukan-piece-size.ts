/**
 * ピースの1辺（px）の範囲と、狙う大きさ。指で1枚を選べ、1枚が埋まるところが画面の中の出来事として見える大きさにする。
 * 上限を超えると、ジグソーではなく数枚の札に見える。
 */
const MIN_PIECE_SIZE = 54;
const MAX_PIECE_SIZE = 84;
const TARGET_PIECE_SIZE = 64;

/** 最後の段が欠けない組み方を、狙う大きさから少し離れても選ぶための、大きさの差（px）の割り引き。 */
const EVEN_ROWS_ALLOWANCE = 6;

export type ZukanPieceLayout = {
  /** ピースの1辺（px）。 */
  pieceSize: number;
  columnCount: number;
};

/**
 * ジグソーを置ける幅に対する、ピースの大きさと列の数。ジグソーは幅いっぱいに組む。
 * 全問を一度に見せるためにピースを小さくしない。収まらない分は縦にスクロールさせる。
 * 最後の段が欠けると1枚のジグソーに見えないので、狙う大きさに近い範囲で、全問を割り切る列の数を優先する。
 */
export function findZukanPieceLayout(
  problemCount: number,
  areaWidth: number,
): ZukanPieceLayout | null {
  if (problemCount === 0 || areaWidth <= 0) {
    return null;
  }
  const maxColumnCount = Math.max(
    1,
    Math.min(problemCount, Math.floor(areaWidth / MIN_PIECE_SIZE)),
  );
  let best: ZukanPieceLayout | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let columnCount = maxColumnCount; columnCount >= 1; columnCount -= 1) {
    const pieceSize = Math.min(
      MAX_PIECE_SIZE,
      Math.floor(areaWidth / columnCount),
    );
    const distance =
      Math.abs(pieceSize - TARGET_PIECE_SIZE) -
      (problemCount % columnCount === 0 ? EVEN_ROWS_ALLOWANCE : 0);
    if (distance < bestDistance) {
      best = { pieceSize, columnCount };
      bestDistance = distance;
    }
    if (pieceSize === MAX_PIECE_SIZE) {
      break;
    }
  }
  return best;
}

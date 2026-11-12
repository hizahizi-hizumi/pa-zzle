/** 台紙に並べるピースの列の数と、1枚の1辺（px）。 */
export type ZukanSheetFit = { columnCount: number; pieceSize: number };

/** ピースの1辺の上限（px）。広い場所に少ない問題を並べるときに、ピースが盤面と張り合う大きさにならないようにする。 */
const MAX_PIECE_SIZE = 30;

/**
 * 幅 `width`・高さ `height` の場所に、`pieceCount` 枚のピースを送らずに全部並べられる、最も大きいピースの並べ方。
 * 幅いっぱいに並べたときに高さへ収まる最も少ない列の数を取る。場所の大きさが分からないうちは `null`。
 */
export function fitZukanSheet(
  width: number,
  height: number,
  pieceCount: number,
): ZukanSheetFit | null {
  if (width <= 0 || height <= 0 || pieceCount <= 0) {
    return null;
  }
  const minColumnCount = Math.max(1, Math.ceil(width / MAX_PIECE_SIZE));
  for (
    let columnCount = minColumnCount;
    columnCount <= pieceCount;
    columnCount += 1
  ) {
    const pieceSize = width / columnCount;
    if (Math.ceil(pieceCount / columnCount) * pieceSize <= height) {
      return { columnCount, pieceSize };
    }
  }
  return { columnCount: pieceCount, pieceSize: width / pieceCount };
}

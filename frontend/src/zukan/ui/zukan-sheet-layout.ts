/**
 * PC の幅で、マスの1辺を最低この大きさ（px）にする。問題の少ないレベルでも盤が空いて見えないよう、問題が少ないほど大きくする。
 * 並びは問題の数の昇順。
 */
const WIDE_SQUARE_SIZES = [
  { maxProblemCount: 250, sizePx: 40 },
  { maxProblemCount: 500, sizePx: 32 },
] as const;
const DEFAULT_WIDE_SQUARE_SIZE_PX = 26;

/** PC より狭い幅で、マスの1辺を最低この大きさ（px）にする。考え方は `WIDE_SQUARE_SIZES` と同じ。 */
const NARROW_SQUARE_SIZES = [{ maxProblemCount: 250, sizePx: 30 }] as const;
const DEFAULT_NARROW_SQUARE_SIZE_PX = 24;

function findSquareSizePx(
  sizes: readonly { maxProblemCount: number; sizePx: number }[],
  defaultSizePx: number,
  problemCount: number,
): number {
  return (
    sizes.find(({ maxProblemCount }) => problemCount <= maxProblemCount)
      ?.sizePx ?? defaultSizePx
  );
}

export function getWideZukanSquareSizePx(problemCount: number): number {
  return findSquareSizePx(
    WIDE_SQUARE_SIZES,
    DEFAULT_WIDE_SQUARE_SIZE_PX,
    problemCount,
  );
}

export function getNarrowZukanSquareSizePx(problemCount: number): number {
  return findSquareSizePx(
    NARROW_SQUARE_SIZES,
    DEFAULT_NARROW_SQUARE_SIZE_PX,
    problemCount,
  );
}

/** PC の幅のマスの大きさを使う画面幅。台紙のクラスの `lg:` と同じ境目にする。 */
const WIDE_MEDIA_QUERY = "(width >= 64rem)";

/**
 * 幅 `widthPx` に `problemCount` 問の台紙を並べたときの列の数。台紙は、マスを最低の大きさ以上で、幅を等分して並べる。
 * 開いていない台紙の並びを、描かずに求めるのに使う。
 */
export function countZukanSheetColumns(
  widthPx: number,
  problemCount: number,
): number {
  const isWide = window.matchMedia?.(WIDE_MEDIA_QUERY).matches ?? false;
  const squareSizePx = isWide
    ? getWideZukanSquareSizePx(problemCount)
    : getNarrowZukanSquareSizePx(problemCount);
  return Math.max(1, Math.floor(widthPx / squareSizePx));
}

// ゲームのホームの余白と段組みが決める値。`GameHomeScreen` のクラスと合わせる。
const SMALL_VIEWPORT_WIDTH_PX = 640;
const WIDE_VIEWPORT_WIDTH_PX = 1024;
const NARROW_SHEET_MARGIN_PX = 48;
const SMALL_SHEET_MARGIN_PX = 72;
const WIDE_SHEET_WIDTH_PX = 664;

/** ゲームのホームで、台紙の上と下にある表示の高さの合計（px）の下限。見出し・レベルのカード・状態ごとの数・「ランダムに遊ぶ」が取る。 */
const SHEET_SURROUNDINGS_MIN_HEIGHT_PX = 240;

/**
 * 画面の高さ `viewportHeightPx` でゲームのホームを開いたときに、台紙が見せられる高さ（px）の上限。
 * 台紙をどの行から見せて開けるかを、開く前に求めるのに使う。実際より低く見積もると、開いたときに台紙をその行まで送れない。
 */
export function estimateZukanSheetMaxVisibleHeightPx(
  viewportHeightPx: number,
): number {
  return Math.max(viewportHeightPx - SHEET_SURROUNDINGS_MIN_HEIGHT_PX, 0);
}

/**
 * 画面幅 `viewportWidthPx` でゲームのホームを開いたときの、台紙のマスを並べる幅（px）。
 * ゲームのホームを開く前に、台紙の並びを求めるのに使う。
 */
export function estimateZukanSheetWidthPx(viewportWidthPx: number): number {
  if (viewportWidthPx >= WIDE_VIEWPORT_WIDTH_PX) {
    return WIDE_SHEET_WIDTH_PX;
  }
  return (
    viewportWidthPx -
    (viewportWidthPx >= SMALL_VIEWPORT_WIDTH_PX
      ? SMALL_SHEET_MARGIN_PX
      : NARROW_SHEET_MARGIN_PX)
  );
}

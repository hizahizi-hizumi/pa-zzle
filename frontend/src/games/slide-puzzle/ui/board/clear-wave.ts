/**
 * 完成演出の、1 から順にタイルを盤へ沈め、数字が並んだことを確かめる波。
 * 盤面の動きとクリア音が同じ時間で揃うよう、ここに置いて両方から使う。
 */

export const CLEAR_WAVE_DURATION_MS = 320;

/** タイルの 190ms の滑りが収まった後に、完成の波を始める。 */
const CLEAR_WAVE_START_DELAY_MS = 220;
const CLEAR_WAVE_SPAN_MS = 310;

/** 木製タイルは跳ね上げず、盤に収まる小さな沈み込みで完成を返す。 */
export const woodworkClearKeyframes: Keyframe[] = [
  { transform: "translateY(0)", filter: "brightness(1)" },
  {
    transform: "translateY(3.8%)",
    filter: "brightness(0.94)",
    offset: 0.3,
  },
  {
    transform: "translateY(1.6%)",
    filter: "brightness(1.045)",
    offset: 0.65,
  },
  { transform: "translateY(0)", filter: "brightness(1)" },
];

/** 3×3〜5×5で波の長さを揃え、枚数が多いほどテンポを細かくする。 */
export function getClearWaveTileDelayMs(
  order: number,
  tileCount: number,
): number {
  return (
    CLEAR_WAVE_START_DELAY_MS +
    (order * CLEAR_WAVE_SPAN_MS) / Math.max(tileCount - 1, 1)
  );
}

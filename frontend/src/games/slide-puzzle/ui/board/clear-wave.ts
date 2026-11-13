/**
 * 完成演出。最後のタイルが収まると、空白に最後の1枚がはまり、1 から順にタイルを持ち上げて、数字が並んだことを確かめる波を送る。
 * 盤面の動きとクリア音が同じ時間で揃うよう、ここに置いて両方から使う。
 */

import { MOTION_DURATION_MS } from "@/lib/motion";

/** タイルの滑りは `--duration-normal` で終わる。最後の1枚は、最後のタイルが収まってから空白へ落とす。 */
export const CLEAR_LAST_PIECE_DELAY_MS = MOTION_DURATION_MS.normal;
export const CLEAR_LAST_PIECE_DURATION_MS = 260;
export const CLEAR_LAST_PIECE_EASING = "cubic-bezier(0.45, 0, 0.6, 1)";
/** 最後の1枚が空白に当たって止まる時刻（落とし始めからの割合）。 */
const CLEAR_LAST_PIECE_LANDING_OFFSET = 0.6;

export const CLEAR_WAVE_DURATION_MS = 360;

/** 波は最後の1枚が収まってから始める。 */
const CLEAR_WAVE_START_DELAY_MS =
  CLEAR_LAST_PIECE_DELAY_MS + CLEAR_LAST_PIECE_DURATION_MS;
const CLEAR_WAVE_STAGGER_MS = 32;

export const clearLastPieceKeyframes: Keyframe[] = [
  {
    transform: "translateY(-45%) scale(1.18)",
    opacity: 0,
    boxShadow: "0 18px 24px rgb(0 0 0 / 0.18)",
  },
  { opacity: 1, offset: 0.25 },
  {
    transform: "translateY(0) scale(1.04, 0.92)",
    boxShadow: "0 2px 3px rgb(0 0 0 / 0.12)",
    offset: CLEAR_LAST_PIECE_LANDING_OFFSET,
  },
  { transform: "translateY(-6%) scale(0.98, 1.03)", offset: 0.8 },
  { transform: "translateY(0) scale(1)", opacity: 1 },
];

/** 完成演出の始まりから、最後の1枚が空白に当たるまでの時間。 */
export const CLEAR_LAST_PIECE_LANDING_MS =
  CLEAR_LAST_PIECE_DELAY_MS +
  CLEAR_LAST_PIECE_DURATION_MS * CLEAR_LAST_PIECE_LANDING_OFFSET;

export const clearWaveKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  {
    transform: "translateY(-15%)",
    boxShadow: "0 10px 16px rgb(0 0 0 / 0.16)",
    offset: 0.4,
  },
  { transform: "translateY(0)" },
];

/** 完成演出の始まりから、`order` 番目（0 始まり）のタイルが持ち上がり始めるまでの時間。 */
export function getClearWaveTileDelayMs(order: number): number {
  return CLEAR_WAVE_START_DELAY_MS + order * CLEAR_WAVE_STAGGER_MS;
}

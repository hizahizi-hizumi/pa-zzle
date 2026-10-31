/**
 * 完成演出の、1 から順にタイルを小さく持ち上げ、数字が並んだことを確かめる波。
 * 盤面の動きとクリア音が同じ時間で揃うよう、ここに置いて両方から使う。
 */

import { MOTION_DURATION_MS } from "@/lib/motion";

export const CLEAR_WAVE_DURATION_MS = 360;

/** タイルの滑りは `--duration-normal` で終わる。完成演出は最後のタイルが収まってから始める。 */
const CLEAR_WAVE_START_DELAY_MS = MOTION_DURATION_MS.normal;
const CLEAR_WAVE_STAGGER_MS = 32;

export const clearWaveKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  {
    transform: "translateY(-6%)",
    boxShadow: "0 6px 12px rgb(0 0 0 / 0.12)",
    offset: 0.4,
  },
  { transform: "translateY(0)" },
];

/** 完成演出の始まりから、`order` 番目（0 始まり）のタイルが持ち上がり始めるまでの時間。 */
export function getClearWaveTileDelayMs(order: number): number {
  return CLEAR_WAVE_START_DELAY_MS + order * CLEAR_WAVE_STAGGER_MS;
}

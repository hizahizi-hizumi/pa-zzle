// 試作 label: 動きの時間と緩急。

export const POUR_TRANSFER_START = 300;
export const POUR_TRANSFER_END = 780;
export const POUR_RETURN_TURNED = 1000;
export const POUR_END = 1120;

/** 注ぎ始めから、満ちた管に封をし始めるまで。 */
export const SEAL_AFTER_POUR = POUR_TRANSFER_END - 20;
export const SEAL_CORK_SEATED = 250;
export const SEAL_CLEAR_START = 140;
export const SEAL_CLEAR_END = 700;
export const SEAL_TAG_START = 330;
export const SEAL_TAG_HUNG = 560;
export const SEAL_DONE = 2000;

/** 最後の封から、棚全体の仕上げが始まるまで。 */
export const FINALE_AFTER_SEAL = 620;
export const FINALE_TAG_STAGGER = 90;
export const FINALE_TAG_ALIGN = 1000;
export const FINALE_SHEEN_START = 250;
export const FINALE_SHEEN_END = 1500;
export const FINALE_COMPLETE = 2900;

export const SHAKE_DURATION = 380;
export const LIFT_DURATION = 190;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function progress(time: number, start: number, end: number): number {
  return clamp01((time - start) / (end - start));
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeIn(t: number): number {
  return t * t * t;
}

export function easeOutBack(t: number): number {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 減衰しながら揺れる。t はミリ秒。 */
export function dampedSwing(
  t: number,
  amplitude: number,
  periodMs: number,
  decayMs: number,
): number {
  if (!(t >= 0) || t > decayMs * 14) {
    return 0;
  }
  return amplitude * Math.exp(-t / decayMs) * Math.sin((2 * Math.PI * t) / periodMs);
}

/** 管ごとに決まった、少しずつ違う値（-1〜1）。 */
export function jitter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

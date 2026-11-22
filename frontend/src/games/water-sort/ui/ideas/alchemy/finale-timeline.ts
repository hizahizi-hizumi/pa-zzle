/**
 * 仕上げの間合い（ms、仕上げの始まりから）。最後のフラスコが封をし終えるのを待ってから、フラスコが左から順に灯り、
 * 工房が明るむ。触らなくても3秒以内に結果へ移る。
 */
export const FINALE_TIMELINE = {
  flareStartMs: 560,
  /** フラスコが順に灯る全体の長さ。本数で割って1本ずつの間をとる。 */
  flareSpreadMs: 900,
  flareDurationMs: 520,
  dawnStartMs: 700,
  dawnDurationMs: 1300,
  doneMs: 2500,
  reducedMotionHoldMs: 1200,
} as const;

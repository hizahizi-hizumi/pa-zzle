/** 1本そろってから、液が内から灯り、蝋で封をして印を押し終えるまでの間合い（ms）。音もこの間合いに合わせる。 */
export const SEALING_TIMELINE = {
  lightDurationMs: 420,
  capStartMs: 300,
  capDurationMs: 200,
  dripStartMs: 460,
  dripDurationMs: 260,
  stampStartMs: 600,
  stampDurationMs: 240,
} as const;

/** 光が灯るときの、一瞬強く灯ってから落ち着く動き。 */
export const SEALING_LIGHT_KEYFRAMES: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 1, filter: "brightness(1.6)", offset: 0.45 },
  { opacity: 1, filter: "brightness(1)", offset: 1 },
];

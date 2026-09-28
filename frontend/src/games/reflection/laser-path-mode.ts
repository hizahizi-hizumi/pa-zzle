/**
 * 光路表示の扱い。
 * - `assist`: 補助。遊び方で補助として説明し、結果画面で光路を確かめた回数を事実として出す。
 * - `normal`: 通常の操作。遊び方で基本操作として説明し、結果画面に回数を出さない。
 *
 * どちらでも外周ヒントを押すと今の盤面での光路を表示し、回数を記録する。スコアには入れない。
 */
export type ReflectionLaserPathMode = "assist" | "normal";

/** 現在の光路表示の扱い。最終レビューで通常の操作へ寄せる場合はここだけを変える。 */
export const reflectionLaserPathMode: ReflectionLaserPathMode = "assist";

export type ReflectionLaserPathPolicy = {
  /** 遊び方で補助機能として説明するか。 */
  describedAsAssist: boolean;
  /** 結果画面に光路を確かめた回数を出すか。 */
  showsCheckCountInResult: boolean;
};

const laserPathPolicies = {
  assist: { describedAsAssist: true, showsCheckCountInResult: true },
  normal: { describedAsAssist: false, showsCheckCountInResult: false },
} as const satisfies Record<ReflectionLaserPathMode, ReflectionLaserPathPolicy>;

export function getReflectionLaserPathPolicy(
  mode: ReflectionLaserPathMode,
): ReflectionLaserPathPolicy {
  return laserPathPolicies[mode];
}

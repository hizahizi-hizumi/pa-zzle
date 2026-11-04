import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 娘が出口の前から、下の縁の切り欠きを抜けて箱の外へ出ていく時間。 */
const DAUGHTER_EXIT_MS = 900;
/** 娘が抜けた後の箱を、結果へ進める前に見せておく時間。 */
const DAUGHTER_EXIT_HOLD_MS = 300;
/** 動きを減らす設定で、出口の前に着いた娘を結果へ進める前に見せておく時間。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 900;

/**
 * 娘の駒が自分の高さの分だけ下へすべり、出口を抜けたところで薄れて消える。
 * 駒の高さは2マスで、出口の前から縁の外まではそれより短いので、薄れ終える前に縁を抜け切る。
 */
const daughterExitKeyframes: Keyframe[] = [
  { transform: "translateY(0)", opacity: 1 },
  { transform: "translateY(60%)", opacity: 1, offset: 0.55 },
  { transform: "translateY(110%)", opacity: 0 },
];

/** クリアした娘を出口から外へ出してから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。 */
export function playDaughterExit(
  daughter: HTMLElement | null,
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      const exit = daughter?.animate?.(daughterExitKeyframes, {
        duration: DAUGHTER_EXIT_MS,
        easing: MOTION_EASING.exit,
        fill: "forwards",
      });
      return exit ? [exit] : [];
    },
    completion: { type: "after-animations", holdMs: DAUGHTER_EXIT_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}

import { DAUGHTER_EXIT_MS } from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 娘が抜けた後の空いた箱を、結果へ進める前に見せておく時間。 */
const DAUGHTER_EXIT_HOLD_MS = 400;
/** 動きを減らす設定で、出口の前に着いた娘を動かさずに見せておく時間。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 1_000;

/**
 * 止まった所から加速し、上の辺が箱の外形の下端を越えるまで（駒の見た目の高さ 1.93 マスに対して、2マスと縁の太さ 0.2 マス分。
 * 高さの 115%）下がって終える。箱の外へ出た分は、箱の外形で切り取られて見えなくなる。
 */
const daughterExitKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: "translateY(115%)" },
];

/**
 * クリアした娘を出口から外へ出してから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * 動きを減らす設定では、出口の前に着いた娘を動かさずに見せてから呼ぶ。
 */
export function playDaughterExit(
  daughter: HTMLElement | null,
  onFinished: () => void,
): () => void {
  let exit: Animation | undefined;
  return playAnimations({
    animate() {
      exit = daughter?.animate?.(daughterExitKeyframes, {
        duration: DAUGHTER_EXIT_MS,
        easing: MOTION_EASING.exit,
        fill: "forwards",
      });
      return exit ? [exit] : [];
    },
    completion: { type: "after-animations", holdMs: DAUGHTER_EXIT_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished() {
      // 結果へ進むと演出を取り消すので、抜け切った姿を駒に書き残し、結果の画面に替わるまでの間に娘が出口の前へ戻って見えないようにする。
      exit?.commitStyles();
      onFinished();
    },
  });
}

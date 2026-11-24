import { type RefObject, useEffect } from "react";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

const clearPulseMs = 520;
const clearHoldMs = 240;

/**
 * 最後の車が出発し終えてから、空になった駐車場を一度弾ませて、完了を知らせる。
 * `ready` は出発の動きを見せ終えたか。動きを減らす設定では動かさず、少し保ってから完了する。
 */
export function useShuttleParkingClearAnimation(
  targetRef: RefObject<HTMLElement | null>,
  clearing: boolean,
  ready: boolean,
  onComplete: () => void,
): void {
  useEffect(() => {
    if (!clearing || !ready) return;
    return playAnimations({
      animate() {
        const animation = targetRef.current?.animate?.(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.04)" },
            { transform: "scale(1)" },
          ],
          { duration: clearPulseMs, easing: MOTION_EASING.celebrate },
        );
        return animation ? [animation] : [];
      },
      completion: { type: "after-animations", holdMs: clearHoldMs },
      reducedMotionHoldMs: clearHoldMs,
      unanimatedHoldMs: clearHoldMs,
      onFinished: onComplete,
    });
  }, [targetRef, clearing, ready, onComplete]);
}

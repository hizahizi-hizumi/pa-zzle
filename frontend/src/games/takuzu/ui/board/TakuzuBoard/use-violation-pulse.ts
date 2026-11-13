import { type RefObject, useEffect } from "react";

import { VIOLATION_MARK_DELAY_MS } from "@/games/takuzu/ui/board/TakuzuBoard/violation-mark-timing";
import { prefersReducedMotion } from "@/lib/motion";

const VIOLATION_PULSE_DURATION_MS = 520;
const VIOLATION_PULSE_EASING = "ease-out";

/**
 * 違反の印が出た瞬間に1回だけ脈打たせ、気づかせてから控えめな姿に戻す。
 * 印が出る前に違反が解けたら、脈も止める。
 */
export function useViolationPulse(
  ref: RefObject<HTMLElement | null>,
  violated: boolean,
  keyframes: Keyframe[],
): void {
  useEffect(() => {
    const element = ref.current;
    if (!violated || typeof element?.animate !== "function") {
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }
    const animation = element.animate(keyframes, {
      duration: VIOLATION_PULSE_DURATION_MS,
      delay: VIOLATION_MARK_DELAY_MS,
      easing: VIOLATION_PULSE_EASING,
    });
    return function stopPulse() {
      animation.cancel();
    };
  }, [ref, violated, keyframes]);
}

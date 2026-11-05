import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type NanpureTutorialRewindProps = {
  /** `true` の間、入れた数字を消したまま保つ。`false` に戻ると消す動きを外す。 */
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** 入れた数字。最初からある数字は始めの盤面に残るので消さない。 */
const enteredDigitSelector = '[data-nanpure-digit="entered"]';
const REWIND_STAGGER_MS = 60;
const REWIND_DURATION_MS = 240;
const REWIND_SETTLE_MS = 120;

const rewindKeyframes: Keyframe[] = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(0.6)" },
];

/**
 * 解き終えた盤面から、入れた数字を左上から右下へ順に消して、始めの盤面へ戻す。
 * 消した数字は、盤面が始めの盤面に替わるまで消したまま保つ。
 */
export function NanpureTutorialRewind({
  active,
  onComplete,
  children,
}: NanpureTutorialRewindProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const digitElements =
          containerRef.current?.querySelectorAll<HTMLElement>(
            enteredDigitSelector,
          ) ?? [];
        return Array.from(digitElements).flatMap(
          function animateDigit(element, order) {
            return (
              element.animate?.(rewindKeyframes, {
                duration: REWIND_DURATION_MS,
                delay: order * REWIND_STAGGER_MS,
                easing: MOTION_EASING.exit,
                fill: "both",
              }) ?? []
            );
          },
        );
      },
      completion: { type: "after-animations", holdMs: REWIND_SETTLE_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return <div ref={containerRef}>{children}</div>;
}

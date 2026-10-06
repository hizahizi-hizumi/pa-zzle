import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type NanpureClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

const CLEAR_PULSE_MS = 700;
const CLEAR_HOLD_MS = 200;

const clearPulseKeyframes: Keyframe[] = [
  { transform: "scale(1)", filter: "saturate(1)" },
  { transform: "scale(1.014)", filter: "saturate(1.24)", offset: 0.5 },
  { transform: "scale(1)", filter: "saturate(1)" },
];

/** 埋まった盤面を小さく脈打たせてから結果へ進める。 */
export function NanpureClearAnimation({
  active,
  onComplete,
  children,
}: NanpureClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const animation = containerRef.current?.animate?.(clearPulseKeyframes, {
          duration: CLEAR_PULSE_MS,
          easing: MOTION_EASING.celebrate,
        });
        return animation ? [animation] : [];
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-violet-200/15 dark:bg-violet-700/10"
        />
      )}
    </div>
  );
}

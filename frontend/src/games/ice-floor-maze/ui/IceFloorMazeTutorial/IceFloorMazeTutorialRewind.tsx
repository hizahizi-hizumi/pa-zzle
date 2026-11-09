import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type IceFloorMazeTutorialRewindProps = {
  /** `true` の間、解き終えた盤面を消していき、消したまま保つ。`false` に戻ると消す動きを外す。 */
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** 解き終えた盤面を消してから、始めの盤面に替えるまで。 */
const REWIND_DURATION_MS = 260;
const REWIND_SETTLE_MS = 80;

const rewindKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

/**
 * 導入で、解き終えた盤面を消して、始めの盤面へ戻す。盤面の要素は解く途中で変わるので、1手ずつ戻さずに盤面ごと替える。
 * 解いた道筋をさかのぼって見せると答えを教えることになるので、駒の動きは見せない。
 * 動きを減らす設定では、消さずにすぐ終える。
 */
export function IceFloorMazeTutorialRewind({
  active,
  onComplete,
  children,
}: IceFloorMazeTutorialRewindProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const animation = containerRef.current?.animate?.(rewindKeyframes, {
          duration: REWIND_DURATION_MS,
          easing: MOTION_EASING.exit,
          fill: "both",
        });
        return animation ? [animation] : [];
      },
      completion: { type: "after-animations", holdMs: REWIND_SETTLE_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}

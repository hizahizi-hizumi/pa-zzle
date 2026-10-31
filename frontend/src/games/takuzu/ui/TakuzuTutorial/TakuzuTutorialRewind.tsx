import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type TakuzuTutorialRewindProps = {
  /** `true` の間、置いたタイルを消したまま保つ。`false` に戻ると消す動きを外す。 */
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** 置いたタイル。固定タイルは始めの盤面に残るので消さない。 */
const placedTileSelector = '[data-takuzu-tile="placed"]';
/** 完成の波と同じく、タイルが `data-clear-wave-step` に持つ「行 + 列」の順で消す。 */
const REWIND_STAGGER_MS = 20;
const REWIND_DURATION_MS = 220;
const REWIND_SETTLE_MS = 80;

const rewindKeyframes: Keyframe[] = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(0.6)" },
];

function getWaveStep(element: HTMLElement): number {
  return Number(element.dataset.clearWaveStep ?? 0);
}

/**
 * 解き終えた盤面から、置いたタイルを左上から右下へ順に消して、始めの盤面へ戻す。
 * 消したタイルは、盤面が始めの盤面に替わるまで消したまま保つ。
 */
export function TakuzuTutorialRewind({
  active,
  onComplete,
  children,
}: TakuzuTutorialRewindProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const tileElements =
          containerRef.current?.querySelectorAll<HTMLElement>(
            placedTileSelector,
          ) ?? [];
        return Array.from(tileElements).flatMap(function animateTile(element) {
          return (
            element.animate?.(rewindKeyframes, {
              duration: REWIND_DURATION_MS,
              delay: getWaveStep(element) * REWIND_STAGGER_MS,
              easing: MOTION_EASING.exit,
              fill: "both",
            }) ?? []
          );
        });
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

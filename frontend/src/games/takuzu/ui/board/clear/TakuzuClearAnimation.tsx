import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type TakuzuClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** 波の中の順番を持つタイル。盤面のマスのタイルが `data-clear-wave-step` に「行 + 列」を置く。 */
const waveCellSelector = "[data-clear-wave-step]";

/** 波の隣り合う順番のタイルが膨らみ始めるまでの間。 */
const CLEAR_WAVE_STAGGER_MS = 35;
const CLEAR_WAVE_DURATION_MS = 380;
const CLEAR_WAVE_PEAK_OFFSET = 0.4;
/** 1枚のタイルが膨らみ始めてから、いちばん膨らむまでの時間。 */
export const CLEAR_WAVE_PEAK_MS =
  CLEAR_WAVE_DURATION_MS * CLEAR_WAVE_PEAK_OFFSET;
const CLEAR_HOLD_MS = 240;

const clearWaveKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.15)", offset: CLEAR_WAVE_PEAK_OFFSET },
  { transform: "scale(1)" },
];

function getWaveStep(element: HTMLElement): number {
  return Number(element.dataset.clearWaveStep ?? 0);
}

/** 揃った盤面のタイルを、左上から右下へ斜めの波で小さく膨らませてから結果へ進める。 */
export function TakuzuClearAnimation({
  active,
  onComplete,
  children,
}: TakuzuClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const cellElements =
          containerRef.current?.querySelectorAll<HTMLElement>(
            waveCellSelector,
          ) ?? [];
        return Array.from(cellElements).flatMap(function animateCell(element) {
          return (
            element.animate?.(clearWaveKeyframes, {
              duration: CLEAR_WAVE_DURATION_MS,
              delay: getWaveStep(element) * CLEAR_WAVE_STAGGER_MS,
              easing: MOTION_EASING.celebrate,
            }) ?? []
          );
        });
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
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

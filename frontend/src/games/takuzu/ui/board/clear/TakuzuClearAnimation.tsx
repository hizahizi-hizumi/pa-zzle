import { type ReactNode, useEffect, useRef } from "react";

type TakuzuClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** 波の中の順番を持つタイル。盤面のマスのタイルが `data-clear-wave-step` に「行 + 列」を置く。 */
const waveCellSelector = "[data-clear-wave-step]";

const CLEAR_WAVE_STAGGER_MS = 35;
const CLEAR_WAVE_DURATION_MS = 380;
const CLEAR_SETTLE_MS = 240;
const CLEAR_WAVE_EASING = "cubic-bezier(.2,.8,.2,1)";

const clearWaveKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.15)", offset: 0.4 },
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

    const cellElements = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(waveCellSelector) ??
        [],
    );
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      cellElements.length === 0 ||
      cellElements.some((element) => typeof element.animate !== "function")
    ) {
      onComplete();
      return;
    }

    const animations = cellElements.map(function animateCell(element) {
      return element.animate(clearWaveKeyframes, {
        duration: CLEAR_WAVE_DURATION_MS,
        delay: getWaveStep(element) * CLEAR_WAVE_STAGGER_MS,
        easing: CLEAR_WAVE_EASING,
      });
    });
    const lastStep = Math.max(...cellElements.map(getWaveStep));
    const timer = window.setTimeout(
      onComplete,
      lastStep * CLEAR_WAVE_STAGGER_MS +
        CLEAR_WAVE_DURATION_MS +
        CLEAR_SETTLE_MS,
    );

    return () => {
      window.clearTimeout(timer);
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}

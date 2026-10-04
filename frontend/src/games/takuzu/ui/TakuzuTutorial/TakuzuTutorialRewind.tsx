import { type ReactNode, useEffect, useRef } from "react";

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
const REWIND_EASING = "cubic-bezier(0.4, 0, 1, 1)";

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

    const tileElements = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(placedTileSelector) ??
        [],
    );
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      tileElements.length === 0 ||
      tileElements.some((element) => typeof element.animate !== "function")
    ) {
      onComplete();
      return;
    }

    const animations = tileElements.map(function animateTile(element) {
      return element.animate(rewindKeyframes, {
        duration: REWIND_DURATION_MS,
        delay: getWaveStep(element) * REWIND_STAGGER_MS,
        easing: REWIND_EASING,
        fill: "both",
      });
    });
    const lastStep = Math.max(...tileElements.map(getWaveStep));
    const timer = window.setTimeout(
      onComplete,
      lastStep * REWIND_STAGGER_MS + REWIND_DURATION_MS + REWIND_SETTLE_MS,
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

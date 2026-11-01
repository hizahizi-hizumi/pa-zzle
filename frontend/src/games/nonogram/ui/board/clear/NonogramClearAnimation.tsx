import { type ReactNode, useLayoutEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type NonogramClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** クリアで消す要素（格子と ×）。盤面が `data-nonogram-clear-fade` を置く。 */
const fadeSelector = "[data-nonogram-clear-fade]";
/** 図柄の塗り。盤面が `data-nonogram-clear-wave` に「行 + 列」を置く。 */
const waveSelector = "[data-nonogram-clear-wave]";

const CLEAR_FADE_DURATION_MS = 360;
/** 格子が消えて図柄が見えてから、塗りの波を始めるまでの間。 */
const CLEAR_WAVE_DELAY_MS = 240;
/** 波の隣り合う順番の塗りが膨らみ始めるまでの間。 */
const CLEAR_WAVE_STAGGER_MS = 28;
const CLEAR_WAVE_DURATION_MS = 420;
const CLEAR_HOLD_MS = 480;
/** 動きを減らす設定で、完成した図柄を見せてから完了するまで。 */
export const REDUCED_MOTION_HOLD_MS = 900;

const fadeKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

const waveKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.12)", offset: 0.4 },
  { transform: "scale(1)" },
];

function getWaveStep(element: HTMLElement): number {
  return Number(element.dataset.nonogramClearWave ?? 0);
}

/**
 * 揃った盤面から格子と × を消して塗りだけの図柄を現し、塗りを左上から右下へ斜めの波で小さく膨らませてから結果へ進める。
 * 格子と × は盤面がクリア後に消した姿で描くので、ここでは消える途中だけを動かす。
 */
export function NonogramClearAnimation({
  active,
  onComplete,
  children,
}: NonogramClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 盤面は消した姿で描き直されるため、描いた直後に消える動きを始めないと、一度消えた姿が見えてしまう。
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const container = containerRef.current;
        if (container === null) {
          return [];
        }
        const fades = Array.from(
          container.querySelectorAll<Element>(fadeSelector),
        ).flatMap(
          (element) =>
            element.animate?.(fadeKeyframes, {
              duration: CLEAR_FADE_DURATION_MS,
              easing: MOTION_EASING.exit,
              fill: "backwards",
            }) ?? [],
        );
        const waves = Array.from(
          container.querySelectorAll<HTMLElement>(waveSelector),
        ).flatMap(
          (element) =>
            element.animate?.(waveKeyframes, {
              duration: CLEAR_WAVE_DURATION_MS,
              delay:
                CLEAR_WAVE_DELAY_MS +
                getWaveStep(element) * CLEAR_WAVE_STAGGER_MS,
              easing: MOTION_EASING.celebrate,
            }) ?? [],
        );
        return [...fades, ...waves];
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="contents">
      {children}
    </div>
  );
}

import { type ReactNode, useLayoutEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type NonogramClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** クリアで消す要素（格子と ×）。盤面が `data-nonogram-clear-fade` を置く。 */
const fadeSelector = "[data-nonogram-clear-fade]";
/** 塗りのマスを並べた盤面。盤面が `data-nonogram-clear-swell` を置く。 */
const swellSelector = "[data-nonogram-clear-swell]";

const CLEAR_FADE_DURATION_MS = 360;
/** 格子が消え始めてから、図柄を膨らませ始めるまでの間。 */
const CLEAR_SWELL_DELAY_MS = 240;
const CLEAR_SWELL_DURATION_MS = 560;
const CLEAR_HOLD_MS = 480;
/** 動きを減らす設定で、完成した図柄を見せてから完了するまで。 */
const REDUCED_MOTION_HOLD_MS = 900;

const fadeKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

/**
 * 盤面の中心を基準に図柄全体を1つの面として膨らませる。マスごとに膨らませると、隣り合うマスの縁が
 * ずれて重なり、図柄の輪郭が段になる。縦15マスの盤面でも、膨らんだ縁がヒントとの間（マスの 0.3 個分）を越えない大きさにする。
 */
const swellKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.04)", offset: 0.4 },
  { transform: "scale(1)" },
];

/**
 * 揃った盤面から格子と × を消して塗りだけの図柄を現し、図柄を小さく膨らませてから結果へ進める。
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
        const swells = Array.from(
          container.querySelectorAll<Element>(swellSelector),
        ).flatMap(
          (element) =>
            element.animate?.(swellKeyframes, {
              duration: CLEAR_SWELL_DURATION_MS,
              delay: CLEAR_SWELL_DELAY_MS,
              easing: MOTION_EASING.celebrate,
            }) ?? [],
        );
        return [...fades, ...swells];
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

export const _private = { REDUCED_MOTION_HOLD_MS };

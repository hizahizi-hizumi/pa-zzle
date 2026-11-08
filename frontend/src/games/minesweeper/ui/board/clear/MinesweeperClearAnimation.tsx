import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type MinesweeperClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** クリア音（`assets/sounds/cleared.flac`）に合わせた盤面完成の長さ。 */
const CLEAR_PULSE_MS = 700;
const CLEAR_HOLD_MS = 200;
const CLEAR_UNANIMATED_HOLD_MS = CLEAR_PULSE_MS + CLEAR_HOLD_MS;

const clearPulseKeyframes: Keyframe[] = [
  { transform: "scale(1)", filter: "saturate(1)" },
  { transform: "scale(1.012)", filter: "saturate(1.12)", offset: 0.5 },
  { transform: "scale(1)", filter: "saturate(1)" },
];

/** 完成した安全マスを左上から右下へ短く照らし、推理で開いた盤面全体を見せる。 */
function animateCompletedCells(container: HTMLElement): Animation[] {
  const cells = Array.from(
    container.querySelectorAll<HTMLElement>('[data-cell-state="revealed"]'),
  );
  const lastIndex = Math.max(1, cells.length - 1);
  return cells.flatMap((cell, index) => {
    if (typeof cell.animate !== "function") {
      return [];
    }
    return [
      cell.animate(
        [
          { filter: "brightness(1)", offset: 0 },
          { filter: "brightness(1.13)", offset: 0.45 },
          { filter: "brightness(1)", offset: 1 },
        ],
        {
          duration: 240,
          delay: Math.round((index / lastIndex) * 440),
          easing: MOTION_EASING.celebrate,
        },
      ),
    ];
  });
}

/** 最終操作で開いた盤面を見せ、完成の余韻を作ってから結果へ進む。 */
export function MinesweeperClearAnimation({
  active,
  onComplete,
  children,
}: MinesweeperClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const container = containerRef.current;
        if (!container?.animate) {
          return [];
        }
        const pulse = container.animate(clearPulseKeyframes, {
          duration: CLEAR_PULSE_MS,
          easing: MOTION_EASING.celebrate,
        });
        return [pulse, ...animateCompletedCells(container)];
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: CLEAR_UNANIMATED_HOLD_MS,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-slate-200/10 dark:bg-slate-700/10"
        />
      )}
    </div>
  );
}

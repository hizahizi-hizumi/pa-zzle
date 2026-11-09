import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type MinesweeperClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** クリア音（`assets/sounds/cleared.flac`）に合わせた盤面完成の長さ。 */
const CELL_HIGHLIGHT_MS = 240;
const CELL_STAGGER_MS = 440;
const CLEAR_HOLD_MS = 200;
const CLEAR_UNANIMATED_HOLD_MS =
  CELL_HIGHLIGHT_MS + CELL_STAGGER_MS + CLEAR_HOLD_MS;

/** 旗を動かさず、完成した安全マスだけを左上から右下へ照らす。 */
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
          duration: CELL_HIGHLIGHT_MS,
          delay: Math.round((index / lastIndex) * CELL_STAGGER_MS),
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
        return container ? animateCompletedCells(container) : [];
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
    </div>
  );
}

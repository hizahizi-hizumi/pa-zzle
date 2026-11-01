import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type MinesweeperTutorialRewindProps = {
  /** `true` の間、閉じるマスを消したまま保つ。`false` に戻ると消す動きを外す。 */
  active: boolean;
  /** 始めの盤面で閉じているマス。 */
  closingCellIndices: readonly number[];
  onComplete: () => void;
  children: ReactNode;
};

/** 完成の脈打ちと別に、マスが `data-wave-step` に持つ「行 + 列」の順で消す。 */
const REWIND_STAGGER_MS = 30;
const REWIND_DURATION_MS = 220;
const REWIND_SETTLE_MS = 80;

const rewindKeyframes: Keyframe[] = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(0.6)" },
];

/**
 * 解き終えた盤面から、始めの盤面で閉じているマスの中身を左上から右下へ順に消して、始めの盤面へ戻す。
 * 消したマスは、盤面が始めの盤面に替わるまで消したまま保つ。
 */
export function MinesweeperTutorialRewind({
  active,
  closingCellIndices,
  onComplete,
  children,
}: MinesweeperTutorialRewindProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const cellElements =
          containerRef.current?.querySelectorAll<HTMLElement>(
            "[data-minesweeper-cell-index]",
          ) ?? [];
        return Array.from(cellElements)
          .filter((element) =>
            closingCellIndices.includes(
              Number(element.dataset.minesweeperCellIndex),
            ),
          )
          .flatMap(function animateCell(element) {
            const face = element.lastElementChild;
            return face instanceof HTMLElement
              ? (face.animate?.(rewindKeyframes, {
                  duration: REWIND_DURATION_MS,
                  delay:
                    Number(element.dataset.waveStep ?? 0) * REWIND_STAGGER_MS,
                  easing: MOTION_EASING.exit,
                  fill: "both",
                }) ?? [])
              : [];
          });
      },
      completion: { type: "after-animations", holdMs: REWIND_SETTLE_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, closingCellIndices, onComplete]);

  return <div ref={containerRef}>{children}</div>;
}

import { type ReactNode, useEffect, useRef } from "react";

import { getMinesweeperCellFaceClassName } from "@/games/minesweeper/ui/board/MinesweeperCellFace";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type MinesweeperTutorialCoverProps = {
  /** `true` の間、開いていないマスの面を重ねて保つ。`false` に戻ると重ねた面を外す。 */
  active: boolean;
  rows: number;
  columns: number;
  /** 始めの盤面で開いていないマス。 */
  coveredCellIndices: readonly number[];
  onComplete: () => void;
  children: ReactNode;
};

/** 左上から右下へ、行と列の和の順に閉じていく。 */
const COVER_STAGGER_MS = 40;
const COVER_DURATION_MS = 220;
const COVER_SETTLE_MS = 80;

const coverKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scale(0.6)" },
  { opacity: 1, transform: "scale(1)" },
];

function getCellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

const hiddenFaceClassName = getMinesweeperCellFaceClassName(
  { state: "hidden" },
  "board",
);

/**
 * 解き終えた盤面に、始めの盤面で開いていないマスの面を左上から順に重ねて、始めの盤面へ戻す。
 * 重ねる面は盤面のマスと同じ格子に並べ、盤面が始めの盤面に替わるまで重ねたまま保つ。
 */
export function MinesweeperTutorialCover({
  active,
  rows,
  columns,
  coveredCellIndices,
  onComplete,
  children,
}: MinesweeperTutorialCoverProps) {
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const faces =
          coverRef.current?.querySelectorAll<HTMLElement>(
            "[data-cover-step]",
          ) ?? [];
        return Array.from(faces).flatMap(function animateFace(element) {
          return (
            element.animate?.(coverKeyframes, {
              duration: COVER_DURATION_MS,
              delay: Number(element.dataset.coverStep ?? 0) * COVER_STAGGER_MS,
              easing: MOTION_EASING.enter,
              fill: "both",
            }) ?? []
          );
        });
      },
      completion: { type: "after-animations", holdMs: COVER_SETTLE_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <div className="relative">
      {children}
      {active && (
        // 盤面と同じ枠線の幅を透明に取り、重ねる面をマスにぴったり合わせる。
        <div
          ref={coverRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid border-t border-l border-transparent"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from(
            { length: rows * columns },
            function renderFace(_, cellIndex) {
              const row = Math.floor(cellIndex / columns);
              const column = cellIndex % columns;
              return coveredCellIndices.includes(cellIndex) ? (
                <div
                  key={getCellKey(row, column)}
                  data-cover-step={row + column}
                  className={hiddenFaceClassName}
                />
              ) : (
                <div
                  key={getCellKey(row, column)}
                  className="aspect-square border-r border-b border-transparent"
                />
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

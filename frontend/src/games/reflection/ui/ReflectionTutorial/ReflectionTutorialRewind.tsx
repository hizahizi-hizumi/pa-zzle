import { type ReactNode, useEffect, useRef } from "react";

import type { ReflectionBoard } from "@/games/reflection/puzzle/board";
import {
  getReflectionBoardGridArea,
  getReflectionFigureTracks,
} from "@/games/reflection/ui/board/board-geometry";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type ReflectionTutorialRewindProps = {
  /** `true` の間、解き終えた盤面のピースを重ねて、1つずつ消していく。`false` に戻ると重ねたピースを外す。 */
  active: boolean;
  /** 解き終えた盤面。ここに置かれたピースを、盤面の同じマスに重ねる。 */
  goal: ReflectionBoard;
  onComplete: () => void;
  children: ReactNode;
};

/** 上の行から順に消していく。 */
const REWIND_STAGGER_MS = 90;
const REWIND_DURATION_MS = 240;
const REWIND_SETTLE_MS = 120;

const rewindKeyframes: Keyframe[] = [
  { opacity: 1, transform: "scale(1)" },
  { opacity: 0, transform: "scale(0.6)" },
];

/**
 * 解き終えた盤面のピースを、始めの盤面（何も置いていない盤面）の上に重ね、上の行から順に消して、始めの盤面へ戻す。
 * 重ねるピースは盤面のマスと同じ格子に並べ、消し終えても盤面が始めの盤面に替わるまで消えたまま保つ。
 */
export function ReflectionTutorialRewind({
  active,
  goal,
  onComplete,
  children,
}: ReflectionTutorialRewindProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const tracks = getReflectionFigureTracks(goal.size);

  useEffect(() => {
    if (!active) {
      return;
    }

    return playAnimations({
      animate() {
        const pieces =
          layerRef.current?.querySelectorAll<HTMLElement>(
            "[data-rewind-step]",
          ) ?? [];
        return Array.from(pieces).flatMap(function animatePiece(element) {
          return (
            element.animate?.(rewindKeyframes, {
              duration: REWIND_DURATION_MS,
              delay:
                Number(element.dataset.rewindStep ?? 0) * REWIND_STAGGER_MS,
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

  const placed = goal.cells.flatMap((cell, cellIndex) =>
    cell === null ? [] : [{ cell, cellIndex }],
  );

  return (
    <div className="relative size-full">
      {children}
      {active && (
        <div
          ref={layerRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: tracks, gridTemplateRows: tracks }}
        >
          <div
            className="grid"
            style={{
              ...getReflectionBoardGridArea(goal.size),
              gridTemplateColumns: `repeat(${goal.size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${goal.size}, minmax(0, 1fr))`,
            }}
          >
            {placed.map(({ cell, cellIndex }, step) => (
              <div
                key={cellIndex}
                data-rewind-step={step}
                className="flex items-center justify-center"
                style={{
                  gridRow: Math.floor(cellIndex / goal.size) + 1,
                  gridColumn: (cellIndex % goal.size) + 1,
                }}
              >
                <ReflectionPieceIcon piece={cell} size="cell" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

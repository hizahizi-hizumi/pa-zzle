import { type ReactNode, useEffect, useRef } from "react";

import { formatTsumeShogiSquareKey } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  CLEAR_WAVE_DURATION_MS,
  planTsumeShogiClearWave,
  type TsumeShogiClearWaveSquare,
} from "@/games/tsume-shogi/ui/board/clear/clear-wave";
import { animateBoardPaint } from "@/lib/board-visual-motion";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type TsumeShogiClearAnimationProps = {
  active: boolean;
  onClearAnimationComplete: () => void;
  children: ReactNode;
};

/** 波を立てる升。升のボタンが `data-file` / `data-rank` に升の位置を置き、照りの層と（駒があれば）駒を子に持つ。 */
const waveSquareSelector = "[data-board-squares] > button[data-file]";
const glowSelector = ":scope > [data-clear-glow]";
const matedKingAttribute = "data-mated-king";

const CLEAR_GLOW_PEAK_OFFSET = 0.35;
/** 波の升が照り始めてから、いちばん明るく照るまでの時間。 */
export const CLEAR_GLOW_PEAK_MS =
  CLEAR_WAVE_DURATION_MS * CLEAR_GLOW_PEAK_OFFSET;

/** 升の光の層は、波の先頭で一度だけ現れて消える。 */
const glowKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: CLEAR_GLOW_PEAK_OFFSET },
  { opacity: 0 },
];

function readWaveSquares(squares: readonly HTMLElement[]) {
  return squares.map(
    (element): TsumeShogiClearWaveSquare => ({
      square: {
        file: Number(element.dataset.file),
        rank: Number(element.dataset.rank),
      },
      matedKing: element.hasAttribute(matedKingAttribute),
    }),
  );
}

/**
 * 詰んだ瞬間に入力を止め、玉から盤の端へ照りの波を広げる。
 * 盤面の駒はその升に固定し、詰み上がりを見せてから結果へ進める。
 */
export function TsumeShogiClearAnimation({
  active,
  onClearAnimationComplete,
  children,
}: TsumeShogiClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const squares = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(waveSquareSelector) ??
        [],
    );
    const waveSquares = readWaveSquares(squares);
    const plan = planTsumeShogiClearWave(waveSquares);
    const elementsBySquare = new Map(
      waveSquares.map(({ square }, index) => [
        formatTsumeShogiSquareKey(square),
        squares[index],
      ]),
    );

    return playAnimations({
      animate() {
        return plan.steps.flatMap((step) => {
          const square = elementsBySquare.get(
            formatTsumeShogiSquareKey(step.square),
          );
          const animation = animateBoardPaint(
            square,
            square?.querySelector(glowSelector),
            glowKeyframes,
            {
              duration: CLEAR_WAVE_DURATION_MS,
              delay: step.delayMs,
              easing: MOTION_EASING.celebrate,
            },
          );
          return animation ? [animation] : [];
        });
      },
      completion: { type: "after-duration", durationMs: plan.totalMs },
      reducedMotionHoldMs: plan.totalMs,
      unanimatedHoldMs: plan.totalMs,
      onFinished: onClearAnimationComplete,
    });
  }, [active, onClearAnimationComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}

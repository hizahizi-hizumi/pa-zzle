import { type ReactNode, useEffect, useRef } from "react";

import { MOTION_EASING, playAnimations } from "@/lib/motion";

type TsumeShogiClearAnimationProps = {
  active: boolean;
  onClearAnimationComplete: () => void;
  children: ReactNode;
};

const boardSquaresSelector = "[data-board-squares] > button";
const matedKingAttribute = "data-mated-king";
const BOARD_FILES = 9;

/** 詰めた手の駒が着いてから、詰みの波が立つまで。 */
const CLEAR_START_DELAY_MS = 260;
/** 玉の升から1升離れるごとに、波が届くのを遅らせる。 */
const CLEAR_WAVE_STAGGER_MS = 70;
const CLEAR_WAVE_DURATION_MS = 420;
const CLEAR_KING_DURATION_MS = 620;
/** 波が収まった詰み上がりの盤を見せる時間。 */
const CLEAR_SETTLE_MS = 700;
/** 揺らさないときも、揺らしたときと同じくらいの間だけ詰み上がりを見せる。 */
const CLEAR_STILL_HOLD_MS =
  CLEAR_START_DELAY_MS + CLEAR_KING_DURATION_MS + CLEAR_SETTLE_MS;

/** 詰んだ玉は大きく揺れて沈む。 */
const matedKingKeyframes: Keyframe[] = [
  { transform: "translateY(0) scale(1) rotate(0deg)" },
  { transform: "translateY(-14%) scale(1.16) rotate(-7deg)", offset: 0.2 },
  { transform: "translateY(-14%) scale(1.16) rotate(7deg)", offset: 0.42 },
  { transform: "translateY(-6%) scale(1.08) rotate(-3deg)", offset: 0.66 },
  { transform: "translateY(0) scale(1) rotate(0deg)" },
];

/** 盤の他の駒は、玉の升から広がる波で一度浮いて着く。 */
const wavePieceKeyframes: Keyframe[] = [
  { transform: "translateY(0) scale(1)" },
  { transform: "translateY(-10%) scale(1.07)", offset: 0.4 },
  { transform: "translateY(0) scale(1)" },
];

/** 升の地（玉の升の詰みの色）は、波の先頭で一度明るく光る。 */
const waveSquareKeyframes: Keyframe[] = [
  { filter: "brightness(1)" },
  { filter: "brightness(1.18)", offset: 0.35 },
  { filter: "brightness(1)" },
];

function squareIndexDistance(index: number, origin: number): number {
  const file = index % BOARD_FILES;
  const rank = Math.floor(index / BOARD_FILES);
  const originFile = origin % BOARD_FILES;
  const originRank = Math.floor(origin / BOARD_FILES);
  return Math.max(Math.abs(file - originFile), Math.abs(rank - originRank));
}

/**
 * 詰んだ瞬間に入力を止め、玉の升を詰みの色で染め、玉を大きく揺らす。同時に玉の升から盤の端へ波を広げ、
 * 盤上の駒を順に浮かせて升を一度光らせる。盤全体が応えるので、他のゲームの完成演出（盤全体の波・脈動・光）と同じ強さになる。
 * 動きを減らす設定では揺らさず、同じくらいの間だけ詰み上がりを見せる。
 */
export function TsumeShogiClearAnimation({
  active,
  onClearAnimationComplete,
  children,
}: TsumeShogiClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    return playAnimations({
      animate() {
        const squares = Array.from(
          containerRef.current?.querySelectorAll<HTMLElement>(
            boardSquaresSelector,
          ) ?? [],
        );
        const kingIndex = squares.findIndex((square) =>
          square.hasAttribute(matedKingAttribute),
        );
        if (kingIndex < 0) return [];
        return squares.flatMap((square, index) => {
          const distance = squareIndexDistance(index, kingIndex);
          const delay = CLEAR_START_DELAY_MS + distance * CLEAR_WAVE_STAGGER_MS;
          const piece = square.querySelector<HTMLElement>(":scope > span");
          const animations: Animation[] = [];
          const squareAnimation = square.animate?.(waveSquareKeyframes, {
            duration: CLEAR_WAVE_DURATION_MS,
            delay,
            easing: MOTION_EASING.celebrate,
          });
          if (squareAnimation) animations.push(squareAnimation);
          const pieceAnimation = piece?.animate?.(
            index === kingIndex ? matedKingKeyframes : wavePieceKeyframes,
            {
              duration:
                index === kingIndex
                  ? CLEAR_KING_DURATION_MS
                  : CLEAR_WAVE_DURATION_MS,
              delay,
              easing: MOTION_EASING.celebrate,
            },
          );
          if (pieceAnimation) animations.push(pieceAnimation);
          return animations;
        });
      },
      completion: { type: "after-animations", holdMs: CLEAR_SETTLE_MS },
      reducedMotionHoldMs: CLEAR_STILL_HOLD_MS,
      unanimatedHoldMs: CLEAR_STILL_HOLD_MS,
      onFinished: onClearAnimationComplete,
    });
  }, [active, onClearAnimationComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}

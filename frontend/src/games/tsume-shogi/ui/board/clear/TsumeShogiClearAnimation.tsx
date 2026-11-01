import { type ReactNode, useEffect, useRef } from "react";

import {
  planTsumeShogiClearWave,
  type TsumeShogiClearWaveSquare,
} from "@/games/tsume-shogi/ui/board/clear/clear-wave";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type TsumeShogiClearAnimationProps = {
  active: boolean;
  onClearAnimationComplete: () => void;
  children: ReactNode;
};

/** 波で動かす升（駒のある升）。升のボタンが `data-file` / `data-rank` に升の位置を置き、駒と光の層を子に持つ。 */
const waveSquareSelector = "[data-board-squares] > button[data-file]";
const pieceSelector = ":scope > [data-piece]";
const glowSelector = ":scope > [data-clear-glow]";
const matedKingAttribute = "data-mated-king";

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

/** 升の光の層は、波の先頭で一度だけ現れて消える。 */
const glowKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.35 },
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
 * 詰んだ瞬間に入力を止め、玉の升を詰みの色で染め、玉を大きく揺らす。同時に玉の升から盤の端へ波を広げ、
 * 駒のある升を順に光らせて駒を浮かせる。盤全体が応えるので、他のゲームの完成演出（盤全体の波・脈動・光）と同じ強さになる。
 * 動きを減らす設定でも、演出と同じ長さだけ詰み上がりを見せてから結果へ進める（`planTsumeShogiClearWave`）。
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
    ).filter(
      (element) =>
        element.querySelector(pieceSelector) !== null ||
        element.hasAttribute(matedKingAttribute),
    );
    const plan = planTsumeShogiClearWave(readWaveSquares(squares));
    const elementsBySquare = new Map(
      squares.map((element) => [
        `${element.dataset.file}-${element.dataset.rank}`,
        element,
      ]),
    );

    return playAnimations({
      animate() {
        return plan.steps.flatMap((step) => {
          const square = elementsBySquare.get(
            `${step.square.file}-${step.square.rank}`,
          );
          const timing = {
            duration: step.durationMs,
            delay: step.delayMs,
            easing: MOTION_EASING.celebrate,
          };
          return [
            square
              ?.querySelector<HTMLElement>(pieceSelector)
              ?.animate?.(
                step.matedKing ? matedKingKeyframes : wavePieceKeyframes,
                timing,
              ),
            square
              ?.querySelector<HTMLElement>(glowSelector)
              ?.animate?.(glowKeyframes, timing),
          ].filter((animation) => animation !== undefined);
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

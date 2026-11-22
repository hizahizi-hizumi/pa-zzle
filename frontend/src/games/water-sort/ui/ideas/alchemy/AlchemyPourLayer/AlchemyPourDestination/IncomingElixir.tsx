import { useEffect, useRef } from "react";

import { POUR_LINEAR_EASING } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { ElixirBand } from "@/games/water-sort/ui/ideas/alchemy/ElixirBand";

type IncomingElixirProps = {
  animation: PourAnimation;
};

/** 泡の横の位置（液の幅に対する%）、大きさ（px）、注いでいる間のどこで湧くか（0〜1）。 */
const fizzBubbles = [
  { leftPercent: 46, sizePx: 2.4, at: 0.05 },
  { leftPercent: 58, sizePx: 1.8, at: 0.22 },
  { leftPercent: 36, sizePx: 2, at: 0.38 },
  { leftPercent: 52, sizePx: 1.6, at: 0.55 },
  { leftPercent: 64, sizePx: 2.2, at: 0.7 },
  { leftPercent: 42, sizePx: 1.5, at: 0.86 },
] as const;

const BUBBLE_RISE_MS = 420;

/** 注ぎ先に溜まっていく霊液と、注いだ所でかすかに立つ泡。 */
export function IncomingElixir({ animation }: IncomingElixirProps) {
  const bandRef = useRef<HTMLSpanElement>(null);
  const bubbleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const startSlot = animation.destination.before.length;
  const slotCount = animation.destination.after.length - startSlot;

  useEffect(() => {
    const transferStartMs =
      POUR_ANIMATION_DURATION_MS * POUR_TRANSFER_START_OFFSET;
    const transferMs =
      POUR_ANIMATION_DURATION_MS *
      (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET);
    const animations = [
      bandRef.current?.animate?.(
        [
          { transform: "scaleY(0)", offset: 0 },
          { transform: "scaleY(0)", offset: POUR_TRANSFER_START_OFFSET },
          { transform: "scaleY(1)", offset: POUR_TRANSFER_END_OFFSET },
          { transform: "scaleY(1)", offset: 1 },
        ],
        {
          duration: POUR_ANIMATION_DURATION_MS,
          easing: POUR_LINEAR_EASING,
          fill: "forwards",
        },
      ),
      ...fizzBubbles.map((bubble, index) =>
        bubbleRefs.current[index]?.animate?.(
          [
            { opacity: 0, transform: "translateY(0) scale(0.4)" },
            {
              opacity: 0.9,
              transform: "translateY(-3px) scale(1)",
              offset: 0.3,
            },
            { opacity: 0, transform: "translateY(-9px) scale(1.1)" },
          ],
          {
            duration: BUBBLE_RISE_MS,
            delay: transferStartMs + transferMs * bubble.at,
            easing: "ease-out",
            fill: "backwards",
          },
        ),
      ),
    ];
    return () => {
      for (const transferAnimation of animations) {
        transferAnimation?.cancel();
      }
    };
  }, []);

  return (
    <>
      <ElixirBand
        colorIndex={animation.colorIndex}
        startSlot={startSlot}
        slotCount={slotCount}
        bandRef={bandRef}
        initialScaleY={0}
      />
      {fizzBubbles.map((bubble, index) => (
        <span
          key={bubble.at}
          ref={(element) => {
            bubbleRefs.current[index] = element;
          }}
          className="absolute rounded-full border border-white/70 opacity-0"
          style={{
            left: `${bubble.leftPercent}%`,
            // 泡は、湧くときの液面の少し下から立つ。
            bottom: `${Math.max(0, (startSlot + slotCount * bubble.at) * 25 - 4)}%`,
            width: `${bubble.sizePx}px`,
            height: `${bubble.sizePx}px`,
            borderWidth: "0.6px",
          }}
        />
      ))}
    </>
  );
}

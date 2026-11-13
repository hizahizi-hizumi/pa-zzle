import { useEffect, useRef } from "react";

import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

type BottleSealProps = {
  colorIndex: number;
  /** 渡すと、`delayMs` 待ってから蓋が上から落ちてはまり、口のまわりがきらめく。渡さなければ蓋をはめた姿だけを描く。 */
  celebration?: { delayMs: number };
};

const SEAL_DROP_DURATION_MS = 240;
const SEAL_DROP_EASING = "cubic-bezier(0.5, 0, 0.75, 0)";
const SPARKLE_DURATION_MS = 320;
const SPARKLE_EASING = "ease-out";
/** 散り終わりに、半ばの位置から外へ伸ばす割合。 */
const SPARKLE_END_SPREAD = 1.25;

/**
 * 口から外へ散るきらめきの向き（度、上が 0）と、半ばで届く距離（ボトルの幅に対する割合）。
 * 上の段のボトルでも盤面の上の手数・時間の行に届かないよう、真上へは飛ばさず、横へ開いて短く散らす。
 */
const sparkles = [
  { angle: -85, distance: 0.7 },
  { angle: -55, distance: 0.5 },
  { angle: 55, distance: 0.5 },
  { angle: 85, distance: 0.7 },
] as const;

/** 1色で満杯になったボトルの口に、その色の蓋をはめる。 */
export function BottleSeal({ colorIndex, celebration }: BottleSealProps) {
  const capRef = useRef<HTMLSpanElement>(null);
  const sparkleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const color = getWaterColorView(colorIndex).color;
  const delayMs = celebration?.delayMs ?? null;

  useEffect(() => {
    const cap = capRef.current;
    if (delayMs === null || typeof cap?.animate !== "function") {
      return;
    }
    const capAnimation = cap.animate(
      [
        { transform: "translateY(-260%) scaleX(0.9)", opacity: 0 },
        {
          transform: "translateY(0) scaleX(1.12) scaleY(0.7)",
          opacity: 1,
          offset: 0.55,
        },
        { transform: "translateY(-30%) scaleX(0.96)", offset: 0.78 },
        { transform: "translateY(0) scaleX(1)", opacity: 1 },
      ],
      {
        duration: SEAL_DROP_DURATION_MS,
        delay: delayMs,
        easing: SEAL_DROP_EASING,
        fill: "backwards",
      },
    );
    const sparkleAnimations = sparkleRefs.current.flatMap((element, index) => {
      const sparkle = sparkles[index];
      if (!element || !sparkle) {
        return [];
      }
      const radians = (sparkle.angle * Math.PI) / 180;
      const x = Math.sin(radians) * sparkle.distance * 100;
      const y = -Math.cos(radians) * sparkle.distance * 100;
      return [
        element.animate(
          [
            {
              transform: "translate(-50%, -50%) scale(0.2) rotate(45deg)",
              opacity: 1,
            },
            {
              transform: `translate(calc(-50% + ${x}cqw), calc(-50% + ${y}cqw)) scale(1) rotate(45deg)`,
              opacity: 1,
              offset: 0.5,
            },
            {
              transform: `translate(calc(-50% + ${x * SPARKLE_END_SPREAD}cqw), calc(-50% + ${y * SPARKLE_END_SPREAD}cqw)) scale(0) rotate(45deg)`,
              opacity: 0,
            },
          ],
          {
            duration: SPARKLE_DURATION_MS,
            delay: delayMs + SEAL_DROP_DURATION_MS * 0.55,
            easing: SPARKLE_EASING,
            fill: "both",
          },
        ),
      ];
    });

    return () => {
      capAnimation.cancel();
      for (const animation of sparkleAnimations) {
        animation.cancel();
      }
    };
  }, [delayMs]);

  return (
    <span
      aria-hidden="true"
      data-bottle-sealed=""
      className="pointer-events-none absolute inset-x-0 top-0 [container-type:inline-size]"
    >
      <span
        ref={capRef}
        className="absolute -top-[5px] left-1/2 h-[14px] w-[calc(100%+4px)] -translate-x-1/2 rounded-[5px] border-2 border-slate-900/25 shadow-[inset_0_3px_0_rgb(255_255_255/0.45),0_2px_3px_rgb(15_23_42/0.18)]"
        style={{ backgroundColor: color }}
      />
      {delayMs === null
        ? null
        : sparkles.map((sparkle, index) => (
            <span
              key={sparkle.angle}
              ref={(element) => {
                sparkleRefs.current[index] = element;
              }}
              className="absolute left-1/2 top-0 size-[11px] rounded-[2px] border-2 border-white opacity-0 shadow-[0_0_0_1px_rgb(15_23_42/0.35),0_0_8px_rgb(255_255_255/0.9)]"
              style={{ backgroundColor: color }}
            />
          ))}
    </span>
  );
}

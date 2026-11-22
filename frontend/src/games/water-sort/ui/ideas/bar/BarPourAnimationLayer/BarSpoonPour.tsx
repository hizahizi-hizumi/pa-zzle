import { useEffect, useMemo, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { BarSpoon } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarSpoonPour/BarSpoon";
import { BAR_POUR_LAYER_ORDER } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/bar-pour-layer-order";
import { getBarLiquid } from "@/games/water-sort/ui/ideas/bar/bar-liquids";
import {
  BAR_POUR_DURATION_MS,
  BAR_POUR_EASING,
  BAR_POUR_PHASE,
  getBarPourPlan,
} from "@/games/water-sort/ui/ideas/bar/bar-pour-timeline";

type BarSpoonPourProps = {
  animation: PourAnimation;
};

/** スプーンの上の端を、液が柄に乗る所からどれだけ上に出すか（グラスの高さに対する割合）。 */
const SPOON_ABOVE_LIP = 0.12;

/** 注ぎ先に差したバースプーンと、その柄を伝って液面へ降りる細い液。 */
export function BarSpoonPour({ animation }: BarSpoonPourProps) {
  const spoonRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const { destination } = animation;
  const geometry = useMemo(() => getBarPourPlan(animation), [animation]);
  const glassWidth = destination.rect.width;
  const spoonWidth = Math.max(11, glassWidth * 0.3);
  const stemWidth = Math.max(2, glassWidth * 0.055);
  const rise = geometry.surfaceAfterY - geometry.surfaceBeforeY;
  // 液面と一緒に上げても、上の端が画面の外へ出ない長さにする。
  const spoonTop = Math.max(
    geometry.streamTopY - destination.rect.height * SPOON_ABOVE_LIP,
    4 - rise,
  );
  const spoonLength = geometry.surfaceBeforeY - spoonTop;
  const streamWidth = stemWidth + 1.4;
  const { color, core } = getBarLiquid(animation.colorIndex);

  useEffect(() => {
    const spoon = spoonRef.current;
    const stream = streamRef.current;
    if (!spoon?.animate || !stream?.animate) {
      return;
    }
    const lowered = destination.rect.height * 0.5;
    const spoonAnimation = spoon.animate(
      [
        { opacity: 0, transform: `translateY(${-lowered}px)`, offset: 0 },
        {
          opacity: 0,
          transform: `translateY(${-lowered}px)`,
          offset: BAR_POUR_PHASE.spoonIn,
          easing: BAR_POUR_EASING.settle,
        },
        {
          opacity: 1,
          transform: "translateY(0px)",
          offset: BAR_POUR_PHASE.spoonSettled,
        },
        {
          opacity: 1,
          transform: "translateY(0px)",
          offset: BAR_POUR_PHASE.transferStart,
          easing: BAR_POUR_EASING.linear,
        },
        {
          opacity: 1,
          transform: `translateY(${rise}px)`,
          offset: BAR_POUR_PHASE.spoonOut,
          easing: BAR_POUR_EASING.travel,
        },
        {
          opacity: 0,
          transform: `translateY(${rise - lowered}px)`,
          offset: BAR_POUR_PHASE.spoonGone,
        },
        { opacity: 0, transform: `translateY(${rise - lowered}px)`, offset: 1 },
      ],
      {
        duration: BAR_POUR_DURATION_MS,
        easing: BAR_POUR_EASING.linear,
        fill: "both",
      },
    );
    const landing = BAR_POUR_PHASE.transferStart;
    const streamAnimation = stream.animate(
      [
        { clipPath: "inset(0 0 100% 0)", offset: 0 },
        { clipPath: "inset(0 0 100% 0)", offset: BAR_POUR_PHASE.tilted - 0.01 },
        { clipPath: "inset(0 0 0% 0)", offset: landing },
        {
          clipPath: "inset(0 0 0% 0)",
          offset: BAR_POUR_PHASE.transferEnd - 0.03,
        },
        {
          clipPath: "inset(100% 0 0% 0)",
          offset: BAR_POUR_PHASE.transferEnd + 0.03,
        },
        { clipPath: "inset(100% 0 0% 0)", offset: 1 },
      ],
      {
        duration: BAR_POUR_DURATION_MS,
        easing: BAR_POUR_EASING.linear,
        fill: "both",
      },
    );
    return () => {
      spoonAnimation.cancel();
      streamAnimation.cancel();
    };
  }, [destination.rect.height, rise]);

  return (
    <>
      <div
        ref={spoonRef}
        aria-hidden="true"
        className="pointer-events-none fixed opacity-0 will-change-transform"
        style={{
          left: geometry.spoonX - spoonWidth / 2,
          top: spoonTop,
          width: spoonWidth,
          height: spoonLength,
          zIndex: BAR_POUR_LAYER_ORDER.spoon,
        }}
      >
        <BarSpoon
          width={spoonWidth}
          length={spoonLength}
          stemWidth={stemWidth}
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full will-change-[clip-path]"
        style={{
          left: geometry.lip.x - streamWidth / 2,
          top: geometry.streamTopY,
          width: streamWidth,
          height: Math.max(
            0,
            geometry.surfaceBeforeY - geometry.streamTopY - 1,
          ),
          clipPath: "inset(0 0 100% 0)",
          background: `linear-gradient(90deg, ${color}, ${core} 45%, ${color})`,
          boxShadow: `0 0 4px ${color}88`,
          zIndex: BAR_POUR_LAYER_ORDER.stream,
        }}
      />
    </>
  );
}

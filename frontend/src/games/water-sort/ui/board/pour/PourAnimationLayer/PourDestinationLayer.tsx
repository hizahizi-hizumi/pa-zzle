import { useEffect, useRef } from "react";

import { getCompletedBottleColor } from "@/games/water-sort/ui/board/bottle-completion";
import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
  POUR_TRANSFER_END_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { AnimatedDestinationTransfer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestinationLayer/AnimatedDestinationTransfer";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

type PourDestinationLayerProps = {
  animations: readonly PourAnimation[];
};

const COMPLETION_BOUNCE_DURATION_MS = 280;

export function PourDestinationLayer({
  animations,
}: PourDestinationLayerProps) {
  const bottleRef = useRef<HTMLDivElement>(null);
  const firstAnimation = animations[0];
  const lastAnimation = animations.at(-1);
  const completedColor =
    lastAnimation &&
    getCompletedBottleColor(lastAnimation.destination.before) === null
      ? getCompletedBottleColor(lastAnimation.destination.after)
      : null;
  // 水が流れ込み終わった瞬間に、蓋をはめてボトルを弾ませる。
  const completionDelayMs =
    lastAnimation && completedColor !== null
      ? lastAnimation.durationMs * POUR_TRANSFER_END_OFFSET
      : null;

  useEffect(() => {
    const bottle = bottleRef.current;
    if (completionDelayMs === null || typeof bottle?.animate !== "function") {
      return;
    }
    const bounce = bottle.animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.06, 0.92)", offset: 0.25 },
        { transform: "scale(0.97, 1.05)", offset: 0.55 },
        { transform: "scale(1, 1)" },
      ],
      {
        duration: COMPLETION_BOUNCE_DURATION_MS,
        delay: completionDelayMs,
        easing: "ease-out",
      },
    );
    return () => bounce.cancel();
  }, [completionDelayMs]);

  if (!firstAnimation) {
    return null;
  }

  return (
    <div
      ref={bottleRef}
      aria-hidden="true"
      className="pointer-events-none fixed aspect-[0.36] origin-bottom rounded-b-[1.45rem]"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        POUR_LAYER_ORDER.destination,
      )}
    >
      <WaterBottle
        contents={firstAnimation.destination.before}
        waterOverlay={animations.map((animation) => (
          <AnimatedDestinationTransfer
            key={animation.id}
            animation={animation}
          />
        ))}
        seal={
          completedColor === null || completionDelayMs === null
            ? undefined
            : {
                colorIndex: completedColor,
                celebration: { delayMs: completionDelayMs },
              }
        }
      />
    </div>
  );
}

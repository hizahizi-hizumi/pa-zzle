import { useEffect, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { getSummerBottleShape } from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import { SummerBottle } from "@/games/water-sort/ui/ideas/summer/SummerBottle";
import { destinationWobbleKeyframes } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/pour-gesture";
import { TransferLiquid } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/TransferLiquid";
import { SUMMER_POUR_DURATION_MS } from "@/games/water-sort/ui/ideas/summer/summer-motion";

type PourDestinationProps = {
  /** 同じ注ぎ先への注ぎ（成立順）。 */
  animations: readonly PourAnimation[];
};

const DESTINATION_LAYER = 1;

export function PourDestination({ animations }: PourDestinationProps) {
  const wobbleRef = useRef<HTMLDivElement>(null);
  const firstAnimation = animations[0];
  const latestAnimationId = animations[animations.length - 1]?.id;

  useEffect(() => {
    if (latestAnimationId === undefined) {
      return;
    }
    const wobble = wobbleRef.current?.animate?.(destinationWobbleKeyframes, {
      duration: SUMMER_POUR_DURATION_MS,
      easing: "linear",
    });
    return () => wobble?.cancel();
  }, [latestAnimationId]);

  if (!firstAnimation) {
    return null;
  }
  const { rect, before, bottleIndex } = firstAnimation.destination;

  return (
    <div
      ref={wobbleRef}
      aria-hidden="true"
      className="pointer-events-none fixed origin-bottom"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: DESTINATION_LAYER,
      }}
    >
      <SummerBottle
        contents={before}
        shape={getSummerBottleShape(bottleIndex)}
        role="pour-destination"
        continuingColorIndex={firstAnimation.colorIndex}
        overlay={animations.map((animation) => (
          <TransferLiquid
            key={animation.id}
            colorIndex={animation.colorIndex}
            startSlot={animation.destination.before.length}
            slotCount={
              animation.destination.after.length -
              animation.destination.before.length
            }
            direction="fill"
          />
        ))}
      />
    </div>
  );
}

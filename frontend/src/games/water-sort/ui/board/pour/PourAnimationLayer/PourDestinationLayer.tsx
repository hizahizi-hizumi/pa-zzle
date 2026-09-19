import { createPortal } from "react-dom";

import {
  destinationPourLayerZIndex,
  getOverlayStyle,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { AnimatedDestinationTransfer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestinationLayer/AnimatedDestinationTransfer";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

type PourDestinationLayerProps = {
  animations: readonly PourAnimation[];
};

export function PourDestinationLayer({
  animations,
}: PourDestinationLayerProps) {
  const firstAnimation = animations[0];
  if (!firstAnimation) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed aspect-[0.36] rounded-b-[1.45rem]"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        destinationPourLayerZIndex,
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
      />
    </div>,
    document.body,
  );
}

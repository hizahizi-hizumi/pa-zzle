import { PourDestinationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestinationLayer";
import { PourSourceLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourSourceLayer";
import {
  groupPourAnimationsByDestination,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";

type PourAnimationLayerProps = {
  appearance: WaterSortAppearance;
  animations: readonly PourAnimation[];
  onFinish: (animationId: number) => void;
};

export function PourAnimationLayer({
  appearance,
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <PourSourceLayer
          appearance={appearance}
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <PourDestinationLayer
            appearance={appearance}
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

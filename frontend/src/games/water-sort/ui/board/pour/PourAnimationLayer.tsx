import { PourDestinationLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestinationLayer";
import { PourSourceLayer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourSourceLayer";
import {
  groupPourAnimationsByDestination,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";

type PourAnimationLayerProps = {
  animations: readonly PourAnimation[];
  onFinish: (animationId: number) => void;
};

export function PourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <PourSourceLayer
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <PourDestinationLayer
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

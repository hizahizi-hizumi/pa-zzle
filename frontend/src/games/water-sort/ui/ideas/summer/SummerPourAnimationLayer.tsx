import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";
import { PourDestination } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/PourDestination";
import { PourSource } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/PourSource";

export function SummerPourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <PourSource
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <PourDestination
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

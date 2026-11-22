import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import { KitchenPourDestination } from "@/games/water-sort/ui/ideas/kitchen/KitchenPourAnimationLayer/KitchenPourDestination";
import { KitchenPourSource } from "@/games/water-sort/ui/ideas/kitchen/KitchenPourAnimationLayer/KitchenPourSource";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";

/** 瓶を持ち上げて傾け、とろりとした太い筋を注ぎ先の瓶へ落とす。 */
export function KitchenPourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <KitchenPourSource
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <KitchenPourDestination
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

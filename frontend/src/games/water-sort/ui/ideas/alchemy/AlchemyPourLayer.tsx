import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import { AlchemyPourDestination } from "@/games/water-sort/ui/ideas/alchemy/AlchemyPourLayer/AlchemyPourDestination";
import { AlchemyPourSource } from "@/games/water-sort/ui/ideas/alchemy/AlchemyPourLayer/AlchemyPourSource";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";

/** 注ぐ演出。フラスコを持ち上げて傾け、霊液を細い糸にして落とす。器はボトルの番号に合う形で描く。 */
export function AlchemyPourLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <AlchemyPourSource
          key={animation.id}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <AlchemyPourDestination
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
    </>
  );
}

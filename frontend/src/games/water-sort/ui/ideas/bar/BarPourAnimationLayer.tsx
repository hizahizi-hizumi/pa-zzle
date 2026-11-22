import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import { BarPourDestination } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarPourDestination";
import { BarPourSource } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarPourSource";
import { BarSpoonPour } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarSpoonPour";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";

/** 注ぎ元のグラスを傾け、注ぎ先に差したバースプーンの柄に伝わせて、液を静かに重ねる。 */
export function BarPourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {groupPourAnimationsByDestination(animations).map(
        (destinationAnimations) => (
          <BarPourDestination
            key={destinationAnimations[0]?.destination.bottleIndex}
            animations={destinationAnimations}
          />
        ),
      )}
      {animations.map((animation) => (
        <BarSpoonPour key={`spoon-${animation.id}`} animation={animation} />
      ))}
      {animations.map((animation) => (
        <BarPourSource
          key={`source-${animation.id}`}
          animation={animation}
          onFinish={onFinish}
        />
      ))}
    </>
  );
}

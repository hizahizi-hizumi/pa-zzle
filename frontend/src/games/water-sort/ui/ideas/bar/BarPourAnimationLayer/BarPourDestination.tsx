import { getOverlayStyle } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { BarGlass } from "@/games/water-sort/ui/ideas/bar/BarGlass";
import { DestinationTransfer } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarPourDestination/DestinationTransfer";
import { FallingIce } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarPourDestination/FallingIce";
import { BAR_POUR_LAYER_ORDER } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/bar-pour-layer-order";
import { isCompletedGlass } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";

type BarPourDestinationProps = {
  animations: readonly PourAnimation[];
};

export function BarPourDestination({ animations }: BarPourDestinationProps) {
  const firstAnimation = animations[0];
  if (!firstAnimation) {
    return null;
  }
  const lastAnimation = animations[animations.length - 1] ?? firstAnimation;
  const completes = isCompletedGlass(lastAnimation.destination.after);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        BAR_POUR_LAYER_ORDER.destination,
      )}
    >
      <BarGlass
        contents={firstAnimation.destination.before}
        role="pour-destination"
        waterOverlay={animations.map((animation) => (
          <DestinationTransfer key={animation.id} animation={animation} />
        ))}
      />
      {completes && (
        <FallingIce
          key={lastAnimation.id}
          glassHeight={lastAnimation.destination.rect.height}
        />
      )}
    </div>
  );
}

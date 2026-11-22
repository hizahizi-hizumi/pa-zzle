import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { KitchenJar } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar";
import { SyrupTransfer } from "@/games/water-sort/ui/ideas/kitchen/KitchenPourAnimationLayer/SyrupTransfer";

type KitchenPourDestinationProps = {
  animations: readonly PourAnimation[];
};

export function KitchenPourDestination({
  animations,
}: KitchenPourDestinationProps) {
  const firstAnimation = animations[0];
  if (!firstAnimation) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        POUR_LAYER_ORDER.destination,
      )}
    >
      <KitchenJar
        contents={firstAnimation.destination.before}
        role="pour-destination"
        waterOverlay={animations.map((animation) => (
          <SyrupTransfer
            key={animation.id}
            colorIndex={animation.colorIndex}
            startSlot={animation.destination.before.length}
            slotCount={
              animation.destination.after.length -
              animation.destination.before.length
            }
            flow="fill"
          />
        ))}
      />
    </div>
  );
}

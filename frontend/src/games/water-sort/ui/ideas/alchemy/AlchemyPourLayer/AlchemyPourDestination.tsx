import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { AlchemyFlask } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask";
import { IncomingElixir } from "@/games/water-sort/ui/ideas/alchemy/AlchemyPourLayer/AlchemyPourDestination/IncomingElixir";
import { getFlaskShape } from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";

type AlchemyPourDestinationProps = {
  animations: readonly PourAnimation[];
};

export function AlchemyPourDestination({
  animations,
}: AlchemyPourDestinationProps) {
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
      <AlchemyFlask
        contents={firstAnimation.destination.before}
        shape={getFlaskShape(firstAnimation.destination.bottleIndex)}
        liquidOverlay={animations.map((animation) => (
          <IncomingElixir key={animation.id} animation={animation} />
        ))}
      />
    </div>
  );
}

import { PourDestination } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination";
import { PourSource } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourSource";
import {
  groupPourAnimationsByDestination,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";

type PourAnimationLayerProps = {
  animations: readonly PourAnimation[];
  onFinish: (animationId: number) => void;
};

/** 試験管ばさみで持った試験管を傾け、口を注ぎ先の口に当てて細く流す。 */
export function PourAnimationLayer({
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
      {groupPourAnimationsByDestination(animations).map((group) => {
        // 同じ注ぎ先へ続けて注いだときは、最後の注ぎの前の姿がそれまでの液を含むので、最後の注ぎだけを描く。
        const latest = group[group.length - 1];
        return (
          latest && (
            <PourDestination
              key={`${latest.destination.bottleIndex}-${latest.id}`}
              animation={latest}
            />
          )
        );
      })}
    </>
  );
}

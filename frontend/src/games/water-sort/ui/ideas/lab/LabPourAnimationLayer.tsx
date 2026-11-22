import { groupPourAnimationsByDestination } from "@/games/water-sort/ui/board/pour/pour-animation";
import { LabPourDestination } from "@/games/water-sort/ui/ideas/lab/LabPourAnimationLayer/LabPourDestination";
import { LabPourSource } from "@/games/water-sort/ui/ideas/lab/LabPourAnimationLayer/LabPourSource";
import type { PourAnimationLayerProps } from "@/games/water-sort/ui/ideas/overrides";

/** 試験管ばさみで持った試験管を傾け、口を注ぎ先の口に当てて細く流す。 */
export function LabPourAnimationLayer({
  animations,
  onFinish,
}: PourAnimationLayerProps) {
  return (
    <>
      {animations.map((animation) => (
        <LabPourSource
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
            <LabPourDestination
              key={`${latest.destination.bottleIndex}-${latest.id}`}
              animation={latest}
            />
          )
        );
      })}
    </>
  );
}

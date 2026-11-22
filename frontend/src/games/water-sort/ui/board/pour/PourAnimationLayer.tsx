import { useState } from "react";

import { createPourClocks } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
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
  const [clocks] = useState(createPourClocks);
  return (
    <>
      {animations.map((animation) => (
        <PourSource
          key={animation.id}
          animation={animation}
          clocks={clocks}
          onFinish={onFinish}
        />
      ))}
      {groupPourAnimationsByDestination(animations).map((group) => {
        const first = group[0];
        return (
          first && (
            <PourDestination
              // 同じ注ぎ先へ続けて注いでも、先の注ぎの液を描き続けるよう、最初の注ぎで見分ける。
              key={`${first.destination.bottleIndex}-${first.id}`}
              animations={group}
              clocks={clocks}
            />
          )
        );
      })}
    </>
  );
}

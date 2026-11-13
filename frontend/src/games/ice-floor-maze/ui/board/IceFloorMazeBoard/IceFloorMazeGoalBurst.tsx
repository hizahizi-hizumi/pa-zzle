import type { Ref } from "react";

import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** 完成演出で続けて広がる輪も、同じ大きさから広げる。 */
export const iceFloorMazeGoalRing = { radius: 0.4, width: 0.08 } as const;

type IceFloorMazeGoalBurstProps = {
  ref: Ref<SVGCircleElement>;
};

/**
 * 親がゴールのマスの中心へ置く。
 * 広がる輪は周りのマスの要素の上に重ねて見せるので、ゴールの印とは別に、マスに載る要素より上の層に描く。
 */
export function IceFloorMazeGoalBurst({ ref }: IceFloorMazeGoalBurstProps) {
  return (
    <circle
      ref={ref}
      r={iceFloorMazeGoalRing.radius}
      strokeWidth={iceFloorMazeGoalRing.width}
      opacity={0}
      fill="none"
      stroke={iceFloorMazeTone.goal}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
}

import type { Ref } from "react";

import { iceFloorMazeGoalRing } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeGoalBurstProps = {
  ref: Ref<SVGCircleElement>;
};

/**
 * ゴールを通り過ぎたときとクリア演出で広がる、ゴールの輪と同じ大きさの輪。ふだんは見せない。親がゴールのマスの中心へ置く。
 * 広がる輪は周りのマスの要素の上に重ねて見せるので、ゴールの印とは別に、マスに載る要素より上の層に描く。
 */
export function IceFloorMazeGoalBurst({ ref }: IceFloorMazeGoalBurstProps) {
  return (
    <circle
      ref={ref}
      r={iceFloorMazeGoalRing.radius}
      strokeWidth={iceFloorMazeGoalRing.width}
      opacity={0}
      className={iceFloorMazeToneClassNames.goalMark}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
}

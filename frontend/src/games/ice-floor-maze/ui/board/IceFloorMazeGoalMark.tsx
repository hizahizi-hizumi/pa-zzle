import type { Ref } from "react";

import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeGoalMarkProps = {
  /** クリア演出で広がる輪。ふだんは見せない。 */
  burstRef?: Ref<SVGCircleElement>;
};

const GOAL_RING_RADIUS = 0.4;
const GOAL_RING_WIDTH = 0.08;
const GOAL_DOT_RADIUS = 0.11;

/** ゴールの輪と中心の点。親がゴールのマスの中心へ置く。駒が止まっても輪は駒の外側に見える。 */
export function IceFloorMazeGoalMark({ burstRef }: IceFloorMazeGoalMarkProps) {
  return (
    <g data-goal="">
      <circle
        r={GOAL_RING_RADIUS}
        strokeWidth={GOAL_RING_WIDTH}
        className={iceFloorMazeToneClassNames.goalMark}
      />
      <circle
        r={GOAL_DOT_RADIUS}
        className={iceFloorMazeToneClassNames.goalDot}
      />
      {burstRef ? (
        <circle
          ref={burstRef}
          r={GOAL_RING_RADIUS}
          strokeWidth={GOAL_RING_WIDTH}
          opacity={0}
          className={iceFloorMazeToneClassNames.goalMark}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ) : null}
    </g>
  );
}

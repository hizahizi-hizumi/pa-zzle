import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

export const iceFloorMazeGoalRing = { radius: 0.4, width: 0.08 } as const;
const GOAL_DOT_RADIUS = 0.11;

/** 止まる位置を読み切るためのゴール印。比較案も同じ印を使う。 */
export function IceFloorMazeGoalMark() {
  return (
    <g data-goal="">
      <circle
        r={iceFloorMazeGoalRing.radius}
        strokeWidth={iceFloorMazeGoalRing.width}
        className={iceFloorMazeToneClassNames.goalMark}
      />
      <circle
        r={GOAL_DOT_RADIUS}
        className={iceFloorMazeToneClassNames.goalDot}
      />
    </g>
  );
}

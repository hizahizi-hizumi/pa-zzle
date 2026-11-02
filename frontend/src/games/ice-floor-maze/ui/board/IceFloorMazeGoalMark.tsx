import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** ゴールの輪の半径と線の太さ。広がる輪も同じ大きさから広げる。 */
export const iceFloorMazeGoalRing = { radius: 0.4, width: 0.08 } as const;
const GOAL_DOT_RADIUS = 0.11;

/**
 * ゴールの輪と中心の点。親がゴールのマスの中心へ置く。駒が止まっても輪は駒の外側に見える。
 * 床に描いた印なので、ゴールへ押し出した雪山やゴールに載った滑る氷の塊はこの上に描く。
 */
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

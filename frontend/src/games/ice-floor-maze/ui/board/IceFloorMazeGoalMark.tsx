import { IceFloorMazeFishMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeFishMark";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** ゴールの輪の半径と線の太さ。広がる輪も同じ大きさから広げる。 */
export const iceFloorMazeGoalRing = { radius: 0.4, width: 0.08 } as const;
const GOAL_DOT_RADIUS = 0.11;

/**
 * ゴールの輪と中心の点。親がゴールのマスの中心へ置く。駒が止まっても輪は駒の外側に見える。
 * 床に描いた印なので、ゴールへ押し出した雪山やゴールに載った滑る氷の塊はこの上に描く。
 */
type IceFloorMazeGoalMarkProps = { look?: IceFloorMazeLook };

export function IceFloorMazeGoalMark({
  look = "current",
}: IceFloorMazeGoalMarkProps) {
  return (
    <g data-goal="">
      {look === "penguin" ? <IceFloorMazeFishMark /> : null}
      {look !== "current" && look !== "penguin" ? (
        <>
          <circle data-goal-aura="" r="0.48" fill="none" strokeWidth="0.025" />
          <circle data-goal-well="" r="0.33" />
          <circle
            data-goal-inner=""
            r="0.275"
            fill="none"
            strokeWidth="0.045"
          />
          <circle data-goal-shine="" cx="-0.155" cy="-0.19" r="0.045" />
        </>
      ) : null}
      {look === "penguin" ? null : look === "current" ? (
        <>
          <circle
            r={iceFloorMazeGoalRing.radius}
            strokeWidth={iceFloorMazeGoalRing.width}
            className={iceFloorMazeToneClassNames.goalMark}
          />
          <circle
            r={GOAL_DOT_RADIUS}
            className={iceFloorMazeToneClassNames.goalDot}
          />
        </>
      ) : (
        <circle data-goal-heart="" r={GOAL_DOT_RADIUS} />
      )}
    </g>
  );
}

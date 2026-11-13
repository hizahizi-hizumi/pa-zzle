import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** 四隅の印が囲む枠の1辺と、角から伸びる線の長さ。枠は駒より外にあり、駒が止まっても見える。 */
const GOAL_BAY = 0.74;
const GOAL_BAY_ARM = 0.2;
const GOAL_BAY_WIDTH = 0.085;
const GOAL_DOT_RADIUS = 0.07;

/**
 * 親がゴールのマスの中心へ置く。
 * ゴールは地形ではなく、通り過ぎることもできる印なので、沈めも立ち上げもしない。線で囲まないので、選択の輪郭にも見えない。
 * 氷に描いた印なので、ゴールへ押し出した雪山やゴールに載った滑る氷の塊はこの上に描く。
 */
export function IceFloorMazeGoalMark() {
  const half = GOAL_BAY / 2;
  const arm = GOAL_BAY_ARM;
  return (
    <g data-goal="">
      <path
        d={[
          `M${-half} ${-half + arm}V${-half}H${-half + arm}`,
          `M${half - arm} ${-half}H${half}V${-half + arm}`,
          `M${half} ${half - arm}V${half}H${half - arm}`,
          `M${-half + arm} ${half}H${-half}V${half - arm}`,
        ].join("")}
        fill="none"
        stroke={iceFloorMazeTone.goal}
        strokeWidth={GOAL_BAY_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle r={GOAL_DOT_RADIUS} fill={iceFloorMazeTone.goal} />
    </g>
  );
}

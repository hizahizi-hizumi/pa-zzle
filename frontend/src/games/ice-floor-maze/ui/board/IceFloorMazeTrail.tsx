import type { Ref } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { getIceFloorMazeCellCenter } from "@/games/ice-floor-maze/ui/board/board-geometry";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTrailProps = {
  board: IceFloorMazeBoard;
  direction: IceFloorMazeDirection;
  from: number;
  to: number;
  /** 帯を滑り始めた端から伸ばす演出で、伸ばす対象にする。 */
  ref?: Ref<SVGGElement>;
  look?: IceFloorMazeLook;
};

const TRAIL_WIDTH = 0.42;

/** 滑り始めた端から伸ばすときの伸びる向きの起点。帯の外接矩形に対する位置。 */
const growthOriginByDirection = {
  up: "center bottom",
  right: "left center",
  down: "center top",
  left: "right center",
} as const satisfies Record<IceFloorMazeDirection, string>;

/** 直前の滑りで、滑り始めたマスの中心から止まったマスの中心まで通った跡。 */
export function IceFloorMazeTrail({
  board,
  direction,
  from,
  to,
  ref,
  look = "current",
}: IceFloorMazeTrailProps) {
  const start = getIceFloorMazeCellCenter(board, from);
  const end = getIceFloorMazeCellCenter(board, to);
  const left = Math.min(start.x, end.x) - TRAIL_WIDTH / 2;
  const top = Math.min(start.y, end.y) - TRAIL_WIDTH / 2;

  return (
    <g
      ref={ref}
      data-trail-group=""
      style={{
        transformBox: "fill-box",
        transformOrigin: growthOriginByDirection[direction],
      }}
    >
      <rect
        data-trail=""
        x={left}
        y={top}
        width={Math.abs(end.x - start.x) + TRAIL_WIDTH}
        height={Math.abs(end.y - start.y) + TRAIL_WIDTH}
        rx={TRAIL_WIDTH / 2}
        className={iceFloorMazeToneClassNames.trail}
      />
      {look === "penguin" ? (
        <>
          <line
            data-penguin-slide-groove=""
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            strokeWidth="0.27"
            strokeLinecap="round"
          />
          <line
            data-penguin-slide-ridge=""
            x1={start.x + (start.y === end.y ? 0 : 0.13)}
            y1={start.y + (start.x === end.x ? 0 : 0.13)}
            x2={end.x + (start.y === end.y ? 0 : 0.13)}
            y2={end.y + (start.x === end.x ? 0 : 0.13)}
            strokeWidth="0.028"
            strokeLinecap="round"
          />
        </>
      ) : look !== "current" ? (
        <>
          <line
            data-ice-skate-mark=""
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            strokeWidth="0.046"
            strokeLinecap="round"
          />
          <line
            data-ice-skate-reflection=""
            x1={start.x + (start.y === end.y ? 0 : 0.11)}
            y1={start.y + (start.x === end.x ? 0 : 0.11)}
            x2={end.x + (start.y === end.y ? 0 : 0.11)}
            y2={end.y + (start.x === end.x ? 0 : 0.11)}
            strokeWidth="0.018"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </g>
  );
}

import type { Ref } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { getIceFloorMazeCellCenter } from "@/games/ice-floor-maze/ui/board/board-geometry";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTrailProps = {
  board: IceFloorMazeBoard;
  direction: IceFloorMazeDirection;
  from: number;
  to: number;
  /** 帯を滑り始めた端から伸ばす演出で、伸ばす対象にする。 */
  ref?: Ref<SVGRectElement>;
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
}: IceFloorMazeTrailProps) {
  const start = getIceFloorMazeCellCenter(board, from);
  const end = getIceFloorMazeCellCenter(board, to);
  const left = Math.min(start.x, end.x) - TRAIL_WIDTH / 2;
  const top = Math.min(start.y, end.y) - TRAIL_WIDTH / 2;

  return (
    <rect
      ref={ref}
      data-trail=""
      x={left}
      y={top}
      width={Math.abs(end.x - start.x) + TRAIL_WIDTH}
      height={Math.abs(end.y - start.y) + TRAIL_WIDTH}
      rx={TRAIL_WIDTH / 2}
      className={iceFloorMazeToneClassNames.trail}
      style={{
        transformBox: "fill-box",
        transformOrigin: growthOriginByDirection[direction],
      }}
    />
  );
}

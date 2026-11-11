import { type Ref, useId } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTrailProps = {
  board: IceFloorMazeBoard;
  direction: IceFloorMazeDirection;
  from: number;
  to: number;
  /** 跡を滑り始めた端から伸ばす演出で、伸ばす対象にする。 */
  ref?: Ref<SVGGElement>;
};

/** 2本の擦り傷の、滑りの中心線からの距離と太さ。 */
const SCRATCH_OFFSET = 0.13;
const SCRATCH_WIDTH = 0.035;
/** 滑り始めから、擦り傷がかすれずに見えるまでのマス数。 */
const SCRATCH_FADE_CELLS = 1;
/** 止まったマスの中心から、擦り傷の終わりまで。駒の下へ傷を入れない。 */
const SCRATCH_GAP = 0.3;

/** 滑り始めた端から伸ばすときの伸びる向きの起点。跡の外接矩形に対する位置。 */
const growthOriginByDirection = {
  up: "center bottom",
  right: "left center",
  down: "center top",
  left: "right center",
} as const satisfies Record<IceFloorMazeDirection, string>;

/** 直前の滑りの跡。駒が氷に付けた2本の擦り傷で、滑り始めはかすれ、止まった駒の手前で終わる。 */
export function IceFloorMazeTrail({
  board,
  direction,
  from,
  to,
  ref,
}: IceFloorMazeTrailProps) {
  const start = getIceFloorMazeCellCenter(board, from);
  const end = getIceFloorMazeCellCenter(board, to);
  const gradientId = `ifm${useId().replace(/[^a-zA-Z0-9]/g, "")}-scratch`;

  const style = {
    transformBox: "fill-box",
    transformOrigin: growthOriginByDirection[direction],
  } as const;

  const palette = iceFloorMazeTone;
  const vector = iceFloorMazeDirectionVectors[direction];
  const scratchFadeEnd = {
    x: start.x + vector.x * SCRATCH_FADE_CELLS,
    y: start.y + vector.y * SCRATCH_FADE_CELLS,
  };
  const scratchEndBeforePiece = {
    x: end.x - vector.x * SCRATCH_GAP,
    y: end.y - vector.y * SCRATCH_GAP,
  };
  return (
    <g ref={ref} data-trail="" style={style}>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={start.x}
          y1={start.y}
          x2={scratchFadeEnd.x}
          y2={scratchFadeEnd.y}
        >
          <stop offset="0" stopColor={palette.trail} stopOpacity="0" />
          <stop offset="1" stopColor={palette.trail} />
        </linearGradient>
      </defs>
      {[-SCRATCH_OFFSET, SCRATCH_OFFSET].map((offset) => (
        <line
          key={offset}
          x1={start.x + vector.y * offset}
          y1={start.y + vector.x * offset}
          x2={scratchEndBeforePiece.x + vector.y * offset}
          y2={scratchEndBeforePiece.y + vector.x * offset}
          stroke={`url(#${gradientId})`}
          strokeWidth={SCRATCH_WIDTH}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

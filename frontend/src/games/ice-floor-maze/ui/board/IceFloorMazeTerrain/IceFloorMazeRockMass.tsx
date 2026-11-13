import { useId } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import { ICE_FLOOR_MAZE_RAISED } from "@/games/ice-floor-maze/ui/board/cell-shapes";
import {
  createIceFloorMazeDrawnCellPath,
  createIceFloorMazeEnclosedOutsidePath,
  createIceFloorMazeMassPath,
  listIceFloorMazeEnclosedOutsideCells,
} from "@/games/ice-floor-maze/ui/board/terrain-paths";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeRockMassProps = {
  board: IceFloorMazeBoard;
  cells: readonly IceFloorMazeStateCell[];
};

/** 岩場を、マスの縁から内へ寄せる量。角は同じ色の太い線で丸める。 */
const MASS_INSET = 0.1;
const MASS_ROUNDING = 0.14;

/**
 * 岩を、隣り合うものをつないだ岩場として描く。1マスずつ同じ石を並べず、並んだ岩を尾根や岩棚の形にして、
 * 氷の通り道と塊を明暗の形で読めるようにする。
 */
export function IceFloorMazeRockMass({
  board,
  cells,
}: IceFloorMazeRockMassProps) {
  const iceClipId = `ifm${useId().replace(/[^a-zA-Z0-9]/g, "")}-rock-ice`;
  const palette = iceFloorMazeTone;
  const { bevel, shadow } = ICE_FLOOR_MAZE_RAISED;
  const enclosed = listIceFloorMazeEnclosedOutsideCells(board);
  function isRockMassCell(cellIndex: number): boolean {
    return cells[cellIndex] === "rock" || enclosed.has(cellIndex);
  }
  const outline = {
    d: createIceFloorMazeMassPath(board, isRockMassCell, MASS_INSET),
    strokeWidth: MASS_ROUNDING,
    strokeLinejoin: "round",
  } as const;
  const iceAreaPath =
    createIceFloorMazeDrawnCellPath(board) +
    createIceFloorMazeEnclosedOutsidePath(board, enclosed);

  return (
    <g>
      <defs>
        <clipPath id={iceClipId}>
          <path d={iceAreaPath} />
        </clipPath>
      </defs>
      {/* 影は氷の面にだけ落とし、盤の端の岩場の影を外壁へはみ出させない。 */}
      <g clipPath={`url(#${iceClipId})`}>
        <path
          {...outline}
          transform={`translate(${shadow} ${shadow})`}
          fill={palette.shadow}
          stroke={palette.shadow}
        />
      </g>
      <path
        {...outline}
        transform={`translate(${bevel / 2} ${bevel / 2})`}
        fill={palette.rockShade}
        stroke={palette.rockShade}
      />
      <path
        {...outline}
        transform={`translate(${-bevel / 2} ${-bevel / 2})`}
        fill={palette.rockLit}
        stroke={palette.rockLit}
      />
      <path
        d={createIceFloorMazeMassPath(
          board,
          isRockMassCell,
          MASS_INSET + bevel / 2,
        )}
        fill={palette.rock}
        stroke={palette.rock}
        strokeWidth={MASS_ROUNDING}
        strokeLinejoin="round"
      />
    </g>
  );
}

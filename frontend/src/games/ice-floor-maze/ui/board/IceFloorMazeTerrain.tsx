import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTerrainProps = {
  board: IceFloorMazeBoard;
  goal: number;
};

const WALL_CORNER_RADIUS = 0.3;
const ICE_JOINT_WIDTH = 0.04;
const ROCK_INSET = 0.06;
const ROCK_CORNER_RADIUS = 0.18;
const ROCK_SHADOW_DEPTH = 0.08;

/** 外壁・氷・岩と、ゴールのマスの地。駒・跡・ゴールの印より下の層に描く。 */
export function IceFloorMazeTerrain({ board, goal }: IceFloorMazeTerrainProps) {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);
  const rockCells = board.cells.flatMap((cell, cellIndex) =>
    cell === "rock"
      ? [{ cellIndex, ...getIceFloorMazeCellCenter(board, cellIndex) }]
      : [],
  );

  return (
    <g>
      <rect
        x={viewBox.minX}
        y={viewBox.minY}
        width={viewBox.width}
        height={viewBox.height}
        rx={WALL_CORNER_RADIUS}
        className={iceFloorMazeToneClassNames.stoneFace}
      />
      <rect
        width={board.width}
        height={board.height}
        className={iceFloorMazeToneClassNames.ice}
      />
      <rect
        x={goalCenter.x - 0.5}
        y={goalCenter.y - 0.5}
        width={1}
        height={1}
        className={iceFloorMazeToneClassNames.goalCell}
      />
      <path
        d={createIceJointPath(board)}
        strokeWidth={ICE_JOINT_WIDTH}
        className={iceFloorMazeToneClassNames.iceJoint}
      />
      {rockCells.map(({ cellIndex, x, y }) => (
        <g key={cellIndex} data-rock-cell={cellIndex}>
          <rect
            x={x - 0.5 + ROCK_INSET}
            y={y - 0.5 + ROCK_INSET + ROCK_SHADOW_DEPTH}
            width={1 - ROCK_INSET * 2}
            height={1 - ROCK_INSET * 2 - ROCK_SHADOW_DEPTH}
            rx={ROCK_CORNER_RADIUS}
            className={iceFloorMazeToneClassNames.stoneShadow}
          />
          <rect
            x={x - 0.5 + ROCK_INSET}
            y={y - 0.5 + ROCK_INSET}
            width={1 - ROCK_INSET * 2}
            height={1 - ROCK_INSET * 2 - ROCK_SHADOW_DEPTH}
            rx={ROCK_CORNER_RADIUS}
            className={iceFloorMazeToneClassNames.stoneFace}
          />
        </g>
      ))}
    </g>
  );
}

/** マスの境目の目地。外壁に接する辺には引かない。 */
function createIceJointPath(board: IceFloorMazeBoard): string {
  const columns = Array.from(
    { length: board.width - 1 },
    (_, index) => `M${index + 1} 0V${board.height}`,
  );
  const rows = Array.from(
    { length: board.height - 1 },
    (_, index) => `M0 ${index + 1}H${board.width}`,
  );
  return [...columns, ...rows].join("");
}

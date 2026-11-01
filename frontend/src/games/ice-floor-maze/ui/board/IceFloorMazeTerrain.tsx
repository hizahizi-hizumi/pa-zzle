import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTerrainProps = {
  board: IceFloorMazeBoard;
  /** 今の盤面のマス。渡さなければ初期盤面のマスを描く。 */
  cells?: readonly IceFloorMazeStateCell[];
  goal: number;
};

const WALL_CORNER_RADIUS = 0.3;
const ICE_JOINT_WIDTH = 0.04;
const ROCK_INSET = 0.06;
const ROCK_CORNER_RADIUS = 0.18;
const ROCK_SHADOW_DEPTH = 0.08;

/** 外壁・氷・岩と、ゴールのマスの地。駒・跡・ゴールの印より下の層に描く。 */
export function IceFloorMazeTerrain({
  board,
  cells = board.cells,
  goal,
}: IceFloorMazeTerrainProps) {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);
  function listCells(kind: IceFloorMazeStateCell) {
    return cells.flatMap((cell, cellIndex) =>
      cell === kind
        ? [{ cellIndex, ...getIceFloorMazeCellCenter(board, cellIndex) }]
        : [],
    );
  }
  const rockCells = listCells("rock");

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
      <ProvisionalElementCells
        brittleRockCells={listCells("brittle-rock")}
        thinIceCells={listCells("thin-ice")}
        waterCells={listCells("water")}
        outsideCells={listCells("outside")}
      />
    </g>
  );
}

type CellCenter = { cellIndex: number; x: number; y: number };

/**
 * もろい岩・薄い氷・水面・盤面の外の仮の描き方。要素を持つ問題はまだ出題しないので、見分けがつくだけの形にとどめる。
 * もろい岩は薄い石、薄い氷は内側の枠、水面は濃い石の地、盤面の外は外壁と同じ石の地。
 */
function ProvisionalElementCells({
  brittleRockCells,
  thinIceCells,
  waterCells,
  outsideCells,
}: {
  brittleRockCells: readonly CellCenter[];
  thinIceCells: readonly CellCenter[];
  waterCells: readonly CellCenter[];
  outsideCells: readonly CellCenter[];
}) {
  return (
    <>
      {outsideCells.map(({ cellIndex, x, y }) => (
        <rect
          key={cellIndex}
          data-outside-cell={cellIndex}
          x={x - 0.5}
          y={y - 0.5}
          width={1}
          height={1}
          className={iceFloorMazeToneClassNames.stoneFace}
        />
      ))}
      {waterCells.map(({ cellIndex, x, y }) => (
        <rect
          key={cellIndex}
          data-water-cell={cellIndex}
          x={x - 0.5 + ROCK_INSET}
          y={y - 0.5 + ROCK_INSET}
          width={1 - ROCK_INSET * 2}
          height={1 - ROCK_INSET * 2}
          rx={ROCK_CORNER_RADIUS}
          className={iceFloorMazeToneClassNames.stoneShadow}
        />
      ))}
      {brittleRockCells.map(({ cellIndex, x, y }) => (
        <rect
          key={cellIndex}
          data-brittle-rock-cell={cellIndex}
          x={x - 0.5 + ROCK_INSET}
          y={y - 0.5 + ROCK_INSET}
          width={1 - ROCK_INSET * 2}
          height={1 - ROCK_INSET * 2}
          rx={ROCK_CORNER_RADIUS}
          opacity={0.6}
          className={iceFloorMazeToneClassNames.stoneFace}
        />
      ))}
      {thinIceCells.map(({ cellIndex, x, y }) => (
        <rect
          key={cellIndex}
          data-thin-ice-cell={cellIndex}
          x={x - 0.5 + ROCK_INSET * 2}
          y={y - 0.5 + ROCK_INSET * 2}
          width={1 - ROCK_INSET * 4}
          height={1 - ROCK_INSET * 4}
          fill="none"
          strokeWidth={ICE_JOINT_WIDTH * 2}
          className={iceFloorMazeToneClassNames.iceJoint}
        />
      ))}
    </>
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

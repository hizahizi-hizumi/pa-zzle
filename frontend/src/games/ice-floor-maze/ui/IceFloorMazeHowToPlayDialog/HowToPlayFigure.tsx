import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";

type HowToPlayFigureProps = {
  /** 1行を1文字列とした盤面。`.` が氷、`#` が岩。 */
  rows: readonly string[];
  goal: number;
  /** 駒のいるマス。 */
  piece: number;
  /** 駒がここまで滑ってきた跡。 */
  trail?: { direction: IceFloorMazeDirection; from: number };
};

/** 盤面と同じ見た目で描く、遊び方の小さな盤面。 */
export function HowToPlayFigure({
  rows,
  goal,
  piece,
  trail,
}: HowToPlayFigureProps) {
  const board = parseIceFloorMazeBoard(rows);
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);
  const pieceCenter = getIceFloorMazeCellCenter(board, piece);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      className="h-20 w-auto shrink-0"
    >
      <IceFloorMazeTerrain board={board} goal={goal} />
      {trail ? (
        <IceFloorMazeTrail
          board={board}
          direction={trail.direction}
          from={trail.from}
          to={piece}
        />
      ) : null}
      <g transform={`translate(${goalCenter.x} ${goalCenter.y})`}>
        <IceFloorMazeGoalMark />
      </g>
      <g transform={`translate(${pieceCenter.x} ${pieceCenter.y})`}>
        <IceFloorMazePieceMark />
      </g>
    </svg>
  );
}

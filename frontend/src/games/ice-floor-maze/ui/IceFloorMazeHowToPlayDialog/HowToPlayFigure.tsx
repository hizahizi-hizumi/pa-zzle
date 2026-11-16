import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";
import { getIceFloorMazeFigureSizeStyle } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-size";

type HowToPlayFigureProps = {
  board: IceFloorMazeBoard;
  state: IceFloorMazeState;
  /** ゴールの無い図では `null`。 */
  goal: number | null;
  /** そのコマへ移った滑りの跡。滑りで移ったのでなければ `null`。 */
  trail: { direction: IceFloorMazeDirection; from: number } | null;
};

/**
 * 押せない図の盤面1つ。本番の盤面部品と同じ地形・ゴールの印・駒・滑りの跡を、動かさずに描く。
 * 大きさは、置き場所が決める図のマスの大きさ（`--ice-floor-maze-figure-cell`）で決める。
 */
export function HowToPlayFigure({
  board,
  state,
  goal,
  trail,
}: HowToPlayFigureProps) {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  // 本番の盤面と同じく、雪山がゴールに載っている間はゴールの印を描かない。
  const goalCenter =
    goal === null || state.cells[goal] === "snow-mound"
      ? null
      : getIceFloorMazeCellCenter(board, goal);
  const pieceCenter = getIceFloorMazeCellCenter(board, state.position);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      className="block shrink-0 overflow-visible"
      style={getIceFloorMazeFigureSizeStyle(board)}
    >
      <IceFloorMazeTerrain
        board={board}
        state={state}
        beneathCellFaces={
          <>
            {trail ? (
              <IceFloorMazeTrail
                board={board}
                direction={trail.direction}
                from={trail.from}
                to={state.position}
              />
            ) : null}
            {goalCenter ? (
              <g transform={`translate(${goalCenter.x} ${goalCenter.y})`}>
                <IceFloorMazeGoalMark />
              </g>
            ) : null}
          </>
        }
      />
      <g transform={`translate(${pieceCenter.x} ${pieceCenter.y})`}>
        <IceFloorMazePieceMark />
      </g>
    </svg>
  );
}

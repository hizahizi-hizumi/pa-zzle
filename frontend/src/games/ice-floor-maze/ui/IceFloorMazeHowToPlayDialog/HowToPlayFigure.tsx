import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";

type HowToPlayFigureProps = {
  /**
   * 1行を1文字列とした盤面。`.` が氷、`#` が岩、`b` がもろい岩、`c` が薄い氷、`x` が盤面の外、
   * `w` が薄い氷の割れた後の水面。
   */
  rows: readonly string[];
  /** ゴールのマス。要素の働きだけを示す図では渡さない。 */
  goal?: number;
  /** 駒のいるマス。 */
  piece: number;
  /** 駒がここまで滑ってきた跡。 */
  trail?: { direction: IceFloorMazeDirection; from: number };
};

/** 水面は初期盤面に現れないので、盤面の記法には無い。図では割れた後の薄い氷として描く。 */
const WATER_NOTATION = "w";

/** 盤面と同じ見た目で描く、遊び方の小さな盤面。 */
export function HowToPlayFigure({
  rows,
  goal,
  piece,
  trail,
}: HowToPlayFigureProps) {
  const board = parseIceFloorMazeBoard(
    rows.map((row) => row.replaceAll(WATER_NOTATION, "c")),
  );
  const cells = rows
    .flatMap((row) => Array.from(row))
    .map(
      (notation, cellIndex): IceFloorMazeStateCell =>
        notation === WATER_NOTATION ? "water" : board.cells[cellIndex]!,
    );
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const goalCenter =
    goal === undefined ? null : getIceFloorMazeCellCenter(board, goal);
  const pieceCenter = getIceFloorMazeCellCenter(board, piece);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      className="h-20 w-auto shrink-0"
    >
      <IceFloorMazeTerrain board={board} cells={cells} goal={goal} />
      {trail ? (
        <IceFloorMazeTrail
          board={board}
          direction={trail.direction}
          from={trail.from}
          to={piece}
        />
      ) : null}
      {goalCenter ? (
        <g transform={`translate(${goalCenter.x} ${goalCenter.y})`}>
          <IceFloorMazeGoalMark />
        </g>
      ) : null}
      <g transform={`translate(${pieceCenter.x} ${pieceCenter.y})`}>
        <IceFloorMazePieceMark />
      </g>
    </svg>
  );
}

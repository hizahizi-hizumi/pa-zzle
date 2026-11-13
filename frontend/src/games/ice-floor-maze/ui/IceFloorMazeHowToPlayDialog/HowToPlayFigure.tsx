import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";
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
   * 1行を1文字列とした盤面。`.` が氷、`#` が岩、`b` がもろい岩、`c` が薄い氷、`o` が床、`s` が雪、`m` が滑る氷の塊、
   * `x` が盤面の外、`w` が薄い氷の割れた後の水面、`r` がもろい岩の崩れた後の跡、`h` が雪を押し出してできた雪山。
   */
  rows: readonly string[];
  /** 要素の働きだけを示す図では、ゴールを渡さない。 */
  goal?: number;
  piece: number;
  trail?: { direction: IceFloorMazeDirection; from: number };
};

/**
 * 要素が変わった後の姿は初期盤面に現れないので、盤面の記法には無い。図では、変わる前の要素と変わった後のマスとして描く。
 */
const changedNotations = {
  w: { initial: "c", current: "water" },
  r: { initial: "b", current: "ice" },
  h: { initial: ".", current: "snow-mound" },
} as const satisfies Record<
  string,
  { initial: string; current: IceFloorMazeStateCell }
>;

function findChangedNotation(notation: string) {
  return Object.hasOwn(changedNotations, notation)
    ? changedNotations[notation as keyof typeof changedNotations]
    : null;
}

export function HowToPlayFigure({
  rows,
  goal,
  piece,
  trail,
}: HowToPlayFigureProps) {
  const board = parseIceFloorMazeBoard(
    rows.map((row) =>
      Array.from(
        row,
        (notation) => findChangedNotation(notation)?.initial ?? notation,
      ).join(""),
    ),
  );
  const initialState = createIceFloorMazeInitialState(board, piece);
  const cells = rows
    .flatMap((row) => Array.from(row))
    .map(
      (notation, cellIndex): IceFloorMazeStateCell =>
        findChangedNotation(notation)?.current ??
        initialState.cells[cellIndex]!,
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
      <IceFloorMazeTerrain
        board={board}
        state={{ cells, blocks: initialState.blocks }}
        beneathCellFaces={
          <>
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
          </>
        }
      />
      <g transform={`translate(${pieceCenter.x} ${pieceCenter.y})`}>
        <IceFloorMazePieceMark />
      </g>
    </svg>
  );
}

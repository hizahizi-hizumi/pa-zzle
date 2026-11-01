import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import { ICE_FLOOR_MAZE_WALL_THICKNESS } from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  IceFloorMazeCellClipPaths,
  useIceFloorMazeCellClipIds,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import {
  IceFloorMazeCellFace,
  type IceFloorMazeCellFaceKind,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellFace";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTerrainProps = {
  board: IceFloorMazeBoard;
  /** 今の盤面のマス。渡さなければ初期盤面のマスを描く。 */
  cells?: readonly IceFloorMazeStateCell[];
  /** ゴールのマス。渡さなければゴールの地を描かない。 */
  goal?: number;
};

const ICE_JOINT_WIDTH = 0.04;

/** マスの姿ごとの、描いたマスを見分ける属性。 */
const cellAttributeByKind = {
  rock: "data-rock-cell",
  "brittle-rock": "data-brittle-rock-cell",
  "thin-ice": "data-thin-ice-cell",
  water: "data-water-cell",
} as const satisfies Record<IceFloorMazeCellFaceKind, string>;

function isCellFaceKind(
  cell: IceFloorMazeStateCell,
): cell is IceFloorMazeCellFaceKind {
  return Object.hasOwn(cellAttributeByKind, cell);
}

/**
 * 外壁・氷・ゴールのマスの地と、岩・もろい岩・薄い氷・水面。駒・跡・ゴールの印より下の層に描く。
 * 盤面の外は描かず、外壁は盤面として描くマスの形に沿って囲む（内側の盤面の外も外壁で縁取る）。
 * もろい岩の姿（`data-cell-body`）は、隣から押されたときの揺れで動かせる。
 */
export function IceFloorMazeTerrain({
  board,
  cells = board.cells,
  goal,
}: IceFloorMazeTerrainProps) {
  const clipIds = useIceFloorMazeCellClipIds();
  const drawnCellPath = createDrawnCellPath(board);
  const goalPosition =
    goal === undefined ? null : getIceFloorMazeCellPosition(board, goal);

  return (
    <g>
      <IceFloorMazeCellClipPaths ids={clipIds} />
      <path
        data-wall=""
        d={drawnCellPath}
        strokeWidth={ICE_FLOOR_MAZE_WALL_THICKNESS * 2}
        strokeLinejoin="round"
        className={iceFloorMazeToneClassNames.wall}
      />
      <path d={drawnCellPath} className={iceFloorMazeToneClassNames.ice} />
      {goalPosition ? (
        <rect
          x={goalPosition.x}
          y={goalPosition.y}
          width={1}
          height={1}
          className={iceFloorMazeToneClassNames.goalCell}
        />
      ) : null}
      <path
        d={createIceJointPath(board)}
        fill="none"
        strokeWidth={ICE_JOINT_WIDTH}
        className={iceFloorMazeToneClassNames.iceJoint}
      />
      {listCellFaces(board, cells).map(({ cellIndex, kind, x, y }) => (
        <g
          // 崩れる・割れるでマスの姿が変わったら描き直す。
          key={`${cellIndex}-${kind}`}
          transform={`translate(${x} ${y})`}
          {...{ [cellAttributeByKind[kind]]: cellIndex }}
        >
          <g
            data-cell-body=""
            style={{ transformBox: "fill-box", transformOrigin: "50% 90%" }}
          >
            <IceFloorMazeCellFace kind={kind} clipIds={clipIds} />
          </g>
        </g>
      ))}
    </g>
  );
}

function listCellFaces(
  board: IceFloorMazeBoard,
  cells: readonly IceFloorMazeStateCell[],
): {
  cellIndex: number;
  kind: IceFloorMazeCellFaceKind;
  x: number;
  y: number;
}[] {
  return cells.flatMap((cell, cellIndex) =>
    isCellFaceKind(cell)
      ? [
          {
            cellIndex,
            kind: cell,
            ...getIceFloorMazeCellPosition(board, cellIndex),
          },
        ]
      : [],
  );
}

function isDrawnCell(board: IceFloorMazeBoard, x: number, y: number): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x < board.width &&
    y < board.height &&
    board.cells[y * board.width + x] !== "outside"
  );
}

/** 盤面として描くマスを1マスずつ並べた形。外壁はこの形の縁を太く描いて、マスの外側へはみ出させる。 */
function createDrawnCellPath(board: IceFloorMazeBoard): string {
  return board.cells
    .flatMap((cell, cellIndex) => {
      if (cell === "outside") {
        return [];
      }
      const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
      return [`M${x} ${y}h1v1h-1Z`];
    })
    .join("");
}

/** 盤面として描くマス同士の境目の目地。外壁に接する辺には引かない。 */
function createIceJointPath(board: IceFloorMazeBoard): string {
  return board.cells
    .flatMap((cell, cellIndex) => {
      if (cell === "outside") {
        return [];
      }
      const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
      return [
        isDrawnCell(board, x + 1, y) ? `M${x + 1} ${y}v1` : "",
        isDrawnCell(board, x, y + 1) ? `M${x} ${y + 1}h1` : "",
      ];
    })
    .join("");
}

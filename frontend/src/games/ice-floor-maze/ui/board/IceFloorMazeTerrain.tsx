import type { ReactNode } from "react";

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
  /** 氷とゴールの地の上、マスに載る要素の下に描くもの（直前の滑りの跡）。 */
  beneathCellFaces?: ReactNode;
};

const ICE_JOINT_WIDTH = 0.04;

/** マスの姿ごとの、描いたマスを見分ける属性。 */
const cellAttributeByKind = {
  rock: "data-rock-cell",
  "brittle-rock": "data-brittle-rock-cell",
  "thin-ice": "data-thin-ice-cell",
  water: "data-water-cell",
  rubble: "data-rubble-cell",
} as const satisfies Record<IceFloorMazeCellFaceKind, string>;

/** 今のマスの姿。初期盤面のもろい岩が氷になったマスは、崩れた跡の石くずとして描く。 */
function getCellFaceKind(
  initial: IceFloorMazeStateCell,
  current: IceFloorMazeStateCell,
): IceFloorMazeCellFaceKind | null {
  if (initial === "brittle-rock" && current === "ice") {
    return "rubble";
  }
  return current === "ice" || current === "outside" ? null : current;
}

/**
 * 外壁・氷・ゴールのマスの地と、岩・もろい岩・崩れたもろい岩の跡・薄い氷・水面。駒・ゴールの印より下の層に描く。
 * 盤面の外は描かず、外壁は盤面として描くマスの形に沿って囲む。盤面に囲まれた内側の盤面の外は外壁と同じ色で塗る。
 * もろい岩の姿（`data-cell-body`）は、隣から押されたときの揺れで動かせる。
 */
export function IceFloorMazeTerrain({
  board,
  cells = board.cells,
  goal,
  beneathCellFaces,
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
      <path
        data-enclosed-outside=""
        d={createEnclosedOutsidePath(board)}
        className={iceFloorMazeToneClassNames.wallFill}
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
      {beneathCellFaces}
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
  return cells.flatMap((cell, cellIndex) => {
    const kind = getCellFaceKind(board.cells[cellIndex] ?? cell, cell);
    return kind
      ? [{ cellIndex, kind, ...getIceFloorMazeCellPosition(board, cellIndex) }]
      : [];
  });
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

/**
 * 盤面に囲まれた内側の盤面の外のマス。盤面の外のマスを、外接の長方形の縁から上下左右にたどって届かないものを選ぶ。
 * 縁から届く盤面の外は盤面の形の切り欠きなので、画面の地のままにする。
 */
function createEnclosedOutsidePath(board: IceFloorMazeBoard): string {
  const { width, height, cells } = board;
  const isOutside = (x: number, y: number) =>
    cells[y * width + x] === "outside";
  const open = new Set<number>();
  const pending: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onEdge && isOutside(x, y)) {
        open.add(y * width + x);
        pending.push([x, y]);
      }
    }
  }
  while (pending.length > 0) {
    const [x, y] = pending.pop()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const index = ny * width + nx;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        isOutside(nx, ny) &&
        !open.has(index)
      ) {
        open.add(index);
        pending.push([nx, ny]);
      }
    }
  }

  return cells
    .flatMap((cell, cellIndex) => {
      if (cell !== "outside" || open.has(cellIndex)) {
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

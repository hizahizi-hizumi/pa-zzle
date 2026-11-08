import { type ReactNode, useId } from "react";

import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
  type IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
  type IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";
import { ICE_FLOOR_MAZE_WALL_THICKNESS } from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  IceFloorMazeCellClipPaths,
  useIceFloorMazeCellClipIds,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import {
  IceFloorMazeCellFace,
  type IceFloorMazeCellFaceKind,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellFace";
import type { IceFloorMazeLook } from "@/games/ice-floor-maze/ui/board/ice-floor-maze-look";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeTerrainProps = {
  look?: IceFloorMazeLook;
  board: IceFloorMazeBoard;
  /** 今の盤面のマスと滑る氷の塊。渡さなければ初期盤面を描く。 */
  state?: Pick<IceFloorMazeState, "cells" | "blocks">;
  /** ゴールのマス。渡さなければゴールの地を描かない。 */
  goal?: number;
  /**
   * 氷とゴールの地の上、マスに載る要素の下に描くもの（直前の滑りの跡とゴールの印）。
   * ゴールへ押し出した雪山とゴールに載った滑る氷の塊は、この上に描いてゴールの印を覆う。
   */
  beneathCellFaces?: ReactNode;
};

const ICE_JOINT_WIDTH = 0.04;

/** マスの姿ごとの、描いたマスを見分ける属性。 */
const cellAttributeByKind = {
  rock: "data-rock-cell",
  "brittle-rock": "data-brittle-rock-cell",
  "thin-ice": "data-thin-ice-cell",
  floor: "data-floor-cell",
  water: "data-water-cell",
  rubble: "data-rubble-cell",
  snow: "data-snow-cell",
  "snow-mound": "data-snow-mound-cell",
  "sliding-block": "data-sliding-block-cell",
} as const satisfies Record<IceFloorMazeCellFaceKind, string>;

/** 今のマスの姿。初期盤面のもろい岩が氷になったマスは、崩れた跡の石くずとして描く。 */
function getCellFaceKind(
  initial: IceFloorMazeCell,
  current: IceFloorMazeStateCell,
): IceFloorMazeCellFaceKind | null {
  if (initial === "brittle-rock" && current === "ice") {
    return "rubble";
  }
  return current === "ice" || current === "outside" ? null : current;
}

/**
 * 外壁・氷・ゴールのマスの地と、床・岩・もろい岩・崩れたもろい岩の跡・薄い氷・水面・雪・雪山と、その上に載る滑る氷の塊。駒より下の層に描く。
 * 盤面の外は描かず、外壁は盤面として描くマスの形に沿って囲む。盤面に囲まれた内側の盤面の外は外壁と同じ色で塗る。
 * もろい岩・雪山・滑る氷の塊の姿（`data-cell-body`）は、隣から押されたときの揺れ・盛り上がり・止まるときのつぶれで動かせる。
 * 滑る氷の塊は、姿を包む `data-block-shift` を動かして、押されて滑る動きを描ける。
 */
export function IceFloorMazeTerrain({
  board,
  look = "current",
  state,
  goal,
  beneathCellFaces,
}: IceFloorMazeTerrainProps) {
  const clipIds = useIceFloorMazeCellClipIds();
  const iceGradientId = useId();
  const iceShineId = useId();
  const surfaceMaskId = useId();
  const iceLightId = useId();
  const drawnCellPath = createDrawnCellPath(board);
  const goalPosition =
    goal === undefined ? null : getIceFloorMazeCellPosition(board, goal);
  // 初期盤面の駒の位置は描かないので、どのマスを渡しても同じ。
  const { cells, blocks } = state ?? createIceFloorMazeInitialState(board, 0);
  const cellFaces = listCellFaces(board, cells);
  // 床は氷と同じく地の面なので、直前の滑りの跡の下に描き、床で止まった滑りの跡を隠さない。
  const floorFaces = cellFaces.filter(({ kind }) => kind === "floor");
  const raisedFaces = cellFaces.filter(({ kind }) => kind !== "floor");

  return (
    <g>
      <IceFloorMazeCellClipPaths ids={clipIds} />
      {look !== "current" ? (
        <defs>
          <linearGradient id={iceGradientId} x1="0" y1="0" x2="1" y2="1">
            {look === "glacier" ? (
              <>
                <stop offset="0%" stopColor="#e6fafb" />
                <stop offset="42%" stopColor="#9bcedb" />
                <stop offset="72%" stopColor="#c4e9f1" />
                <stop offset="100%" stopColor="#70b3cc" />
              </>
            ) : look === "penguin" ? (
              <>
                <stop offset="0%" stopColor="#e8ffff" />
                <stop offset="45%" stopColor="#a5e0ea" />
                <stop offset="100%" stopColor="#71baca" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#276a82" />
                <stop offset="45%" stopColor="#164a63" />
                <stop offset="100%" stopColor="#0c2c48" />
              </>
            )}
          </linearGradient>
          <linearGradient id={iceShineId} x1="0" y1="0" x2="0.85" y2="1">
            <stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity={look === "glacier" ? 0.28 : 0.18}
            />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0" />
            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity={look === "glacier" ? 0.22 : 0.09}
            />
          </linearGradient>
          <radialGradient id={iceLightId} cx="0.18" cy="0.15" r="0.95">
            <stop
              offset="0%"
              stopColor="#e8ffff"
              stopOpacity={look === "glacier" ? 0.42 : 0.17}
            />
            <stop offset="65%" stopColor="#e8ffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={surfaceMaskId}>
            <path d={drawnCellPath} />
          </clipPath>
        </defs>
      ) : null}
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
      {look !== "current" ? (
        <>
          <path d={drawnCellPath} fill={`url(#${iceGradientId})`} />
          <path
            data-ice-sheen=""
            d={drawnCellPath}
            fill={`url(#${iceShineId})`}
          />
          <path d={drawnCellPath} fill={`url(#${iceLightId})`} />
          <g clipPath={`url(#${surfaceMaskId})`} data-ice-refraction="">
            <path
              d={`M -2 ${board.height * 0.28} Q ${board.width * 0.35} ${-board.height * 0.1} ${board.width + 2} ${board.height * 0.36}`}
            />
            <path
              d={`M -2 ${board.height * 0.36} Q ${board.width * 0.35} ${board.height * 0.02} ${board.width + 2} ${board.height * 0.43}`}
            />
            <path
              d={`M -2 ${board.height * 0.89} Q ${board.width * 0.46} ${board.height * 0.57} ${board.width + 2} ${board.height * 0.79}`}
            />
          </g>
        </>
      ) : null}
      {look !== "current" ? (
        <path
          data-ice-rim=""
          d={drawnCellPath}
          fill="none"
          strokeWidth="0.055"
          strokeLinejoin="round"
        />
      ) : null}
      {goalPosition ? (
        <rect
          data-goal-cell=""
          x={goalPosition.x}
          y={goalPosition.y}
          width={1}
          height={1}
          className={iceFloorMazeToneClassNames.goalCell}
        />
      ) : null}
      <path
        data-ice-joints=""
        d={createIceJointPath(board)}
        fill="none"
        strokeWidth={ICE_JOINT_WIDTH}
        className={iceFloorMazeToneClassNames.iceJoint}
      />
      {floorFaces.map(renderCellFace)}
      {beneathCellFaces}
      {raisedFaces.map(renderCellFace)}
      {blocks.map(renderBlock)}
    </g>
  );

  function renderBlock(cellIndex: number) {
    const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
    return (
      <g
        key={cellIndex}
        transform={`translate(${x} ${y})`}
        {...{ [cellAttributeByKind["sliding-block"]]: cellIndex }}
      >
        <g data-block-shift="">
          <g
            data-cell-body=""
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <IceFloorMazeCellFace
              kind="sliding-block"
              clipIds={clipIds}
              look={look}
            />
          </g>
        </g>
      </g>
    );
  }

  function renderCellFace({ cellIndex, kind, x, y }: IceFloorMazeCellFaceItem) {
    return (
      <g
        // 崩れる・割れる・押し出すでマスの姿が変わったら描き直す。
        key={`${cellIndex}-${kind}`}
        transform={`translate(${x} ${y})`}
        {...{ [cellAttributeByKind[kind]]: cellIndex }}
      >
        <g
          data-cell-body=""
          style={{ transformBox: "fill-box", transformOrigin: "50% 90%" }}
        >
          <IceFloorMazeCellFace kind={kind} clipIds={clipIds} look={look} />
        </g>
      </g>
    );
  }
}

type IceFloorMazeCellFaceItem = {
  cellIndex: number;
  kind: IceFloorMazeCellFaceKind;
  x: number;
  y: number;
};

function listCellFaces(
  board: IceFloorMazeBoard,
  cells: readonly IceFloorMazeStateCell[],
): IceFloorMazeCellFaceItem[] {
  return cells.flatMap((cell, cellIndex) => {
    const kind = getCellFaceKind(board.cells[cellIndex]!, cell);
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

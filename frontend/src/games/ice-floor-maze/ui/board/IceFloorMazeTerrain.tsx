import type { ReactNode } from "react";

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
import type { IceFloorMazeCellFaceKind } from "@/games/ice-floor-maze/ui/board/cell-face-kind";
import {
  IceFloorMazeCellClipPaths,
  useIceFloorMazeCellClipIds,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { IceFloorMazeCellFace } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellFace";
import { IceFloorMazeGround } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain/IceFloorMazeGround";
import { IceFloorMazeRockMass } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain/IceFloorMazeRockMass";

type IceFloorMazeTerrainProps = {
  board: IceFloorMazeBoard;
  /** 今の盤面のマスと滑る氷の塊。渡さなければ初期盤面を描く。 */
  state?: Pick<IceFloorMazeState, "cells" | "blocks">;
  /**
   * 氷の上、マスに載る要素の下に描くもの（直前の滑りの跡とゴールの印）。
   * ゴールへ押し出した雪山とゴールに載った滑る氷の塊は、この上に描いてゴールの印を覆う。
   */
  beneathCellFaces?: ReactNode;
};

/** マスの姿ごとの、描いたマスを見分ける属性。 */
const cellAttributeByKind = {
  "brittle-rock": "data-brittle-rock-cell",
  "thin-ice": "data-thin-ice-cell",
  floor: "data-floor-cell",
  water: "data-water-cell",
  rubble: "data-rubble-cell",
  snow: "data-snow-cell",
  "snow-mound": "data-snow-mound-cell",
  "sliding-block": "data-sliding-block-cell",
} as const satisfies Record<IceFloorMazeCellFaceKind, string>;

/** 今のマスの姿。初期盤面のもろい岩が氷になったマスは、崩れた跡の石くずとして描く。岩は岩場としてまとめて描くので、ここでは描かない。 */
function getCellFaceKind(
  initial: IceFloorMazeCell,
  current: IceFloorMazeStateCell,
): IceFloorMazeCellFaceKind | null {
  if (initial === "brittle-rock" && current === "ice") {
    return "rubble";
  }
  return current === "ice" || current === "outside" || current === "rock"
    ? null
    : current;
}

/**
 * 外壁・氷と、床・岩・もろい岩・崩れたもろい岩の跡・薄い氷・水面・雪・雪山と、その上に載る滑る氷の塊。駒より下の層に描く。
 * 盤面の外は描かず、外壁は盤面として描くマスの形に沿って囲む。盤面に囲まれた内側の盤面の外は、隣り合う岩とつないだ岩場として描く。
 * もろい岩・雪山・滑る氷の塊の姿（`data-cell-body`）は、隣から押されたときの揺れ・盛り上がり・止まるときのつぶれで動かせる。
 * 滑る氷の塊は、姿を包む `data-block-shift` を動かして、押されて滑る動きを描ける。
 */
export function IceFloorMazeTerrain({
  board,
  state,
  beneathCellFaces,
}: IceFloorMazeTerrainProps) {
  const clipIds = useIceFloorMazeCellClipIds();
  // 初期盤面の駒の位置は描かないので、どのマスを渡しても同じ。
  const { cells, blocks } = state ?? createIceFloorMazeInitialState(board, 0);
  const cellFaces = listCellFaces(board, cells);
  // 床は氷と同じく地の面なので、直前の滑りの跡の下に描き、床で止まった滑りの跡を隠さない。
  const floorFaces = cellFaces.filter(({ kind }) => kind === "floor");
  const raisedFaces = cellFaces.filter(({ kind }) => kind !== "floor");

  return (
    <g>
      <IceFloorMazeCellClipPaths ids={clipIds} />
      <IceFloorMazeGround board={board} />
      {floorFaces.map(renderCellFace)}
      {beneathCellFaces}
      <IceFloorMazeRockMass board={board} cells={cells} />
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
            <IceFloorMazeCellFace kind="sliding-block" clipIds={clipIds} />
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
          <IceFloorMazeCellFace
            kind={kind}
            clipIds={clipIds}
            cellIndex={cellIndex}
          />
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

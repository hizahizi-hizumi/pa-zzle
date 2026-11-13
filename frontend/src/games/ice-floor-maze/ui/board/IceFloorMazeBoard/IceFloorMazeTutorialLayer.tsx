import type { CSSProperties } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeBoardViewBox } from "@/games/ice-floor-maze/ui/board/board-geometry";
import type { IceFloorMazeCellCue } from "@/games/ice-floor-maze/ui/board/cell-cue";

type IceFloorMazeTutorialLayerProps = {
  board: IceFloorMazeBoard;
  cue: IceFloorMazeCellCue | null;
  spotlitCells: readonly number[];
};

/** マスの単位で表した、マスを並べた長方形。 */
type CellRect = { x: number; y: number; width: number; height: number };

/**
 * 抜くマスを、行ごとに続くマスの並びにまとめ、同じ幅の並びが縦に続けば1つの長方形にまとめる。
 * 隣り合うマスを1マスずつ抜くと、抜いた所の境目に覆いの細い線が残るので、続くマスは1つの長方形で抜く。
 */
function mergeCellRects(
  board: IceFloorMazeBoard,
  cells: readonly number[],
): CellRect[] {
  const spotlit = new Set(cells);
  const rows: CellRect[] = [];
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (!spotlit.has(y * board.width + x)) {
        continue;
      }
      const last = rows.at(-1);
      if (last && last.y === y && last.x + last.width === x) {
        last.width += 1;
      } else {
        rows.push({ x, y, width: 1, height: 1 });
      }
    }
  }
  const merged: CellRect[] = [];
  for (const row of rows) {
    const above = merged.find(
      (rect) =>
        rect.x === row.x &&
        rect.width === row.width &&
        rect.y + rect.height === row.y,
    );
    if (above) {
      above.height += 1;
    } else {
      merged.push({ ...row });
    }
  }
  return merged;
}

/** 盤面の座標の長方形を、外壁を含めた盤面の描画範囲に対する割合で置く。 */
function getRectStyle(board: IceFloorMazeBoard, rect: CellRect): CSSProperties {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  return {
    left: `${((rect.x - viewBox.minX) / viewBox.width) * 100}%`,
    top: `${((rect.y - viewBox.minY) / viewBox.height) * 100}%`,
    width: `${(rect.width / viewBox.width) * 100}%`,
    height: `${(rect.height / viewBox.height) * 100}%`,
  };
}

function getCellStyle(
  board: IceFloorMazeBoard,
  cellIndex: number,
): CSSProperties {
  return getRectStyle(board, {
    ...getIceFloorMazeCellPosition(board, cellIndex),
    width: 1,
    height: 1,
  });
}

/**
 * チュートリアルで盤面の上に重ねる、駒を止めるマスの印と、駒を滑らせる向きへ滑る指と、盤面の覆いから抜くマス。
 * マスは角の無い正方形で並ぶので、印も抜く所もマスの形のまま角を付けない。
 */
export function IceFloorMazeTutorialLayer({
  board,
  cue,
  spotlitCells,
}: IceFloorMazeTutorialLayerProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {mergeCellRects(board, spotlitCells).map((rect) => (
        <span
          key={`${rect.x},${rect.y}`}
          className="absolute"
          style={getRectStyle(board, rect)}
        >
          <TutorialSpotlight active className="inset-0" />
        </span>
      ))}
      {cue ? (
        <span
          data-cell-cue={cue.cellIndex}
          className="absolute"
          style={getCellStyle(board, cue.cellIndex)}
        >
          {/* マスの縁は抜いた所と覆いの境目に重なり、印の線が覆いの縁に紛れるので、マスの内側に引く。 */}
          <span className="absolute inset-1">
            <TutorialCue kind="mark" recallId={cue.recallId} />
          </span>
        </span>
      ) : null}
      {cue?.swipe ? (
        <span
          data-swipe-cue={cue.swipe.cellIndex}
          className="absolute"
          style={getCellStyle(board, cue.swipe.cellIndex)}
        >
          {/* 駒のマスの下は盤面の外か別のマスなので、指は駒のマスの中から滑らせる。 */}
          <span className="absolute inset-1">
            <TutorialCue
              kind="pointer"
              recallId={cue.recallId}
              placement="center"
              swipe={cue.swipe.direction}
              // 印は止まるマスの1つだけにする。駒のマスにも輪郭を描くと、どちらが止まる所か見分けにくい。
              outlined={false}
            />
          </span>
        </span>
      ) : null}
    </div>
  );
}

export const _private = { mergeCellRects };

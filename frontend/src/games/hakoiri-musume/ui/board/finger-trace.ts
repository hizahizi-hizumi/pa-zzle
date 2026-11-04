import {
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumePlacementCheck } from "@/games/hakoiri-musume/puzzle/rules";

/**
 * 指につれて動かす駒の左上の位置。押した点からの指のずれを、押したときの駒の左上のマスに足した値で、マス幅を 1 とする。
 * 駒の左上が整数の位置にあるとき、駒はマスにぴったり収まっている。
 */
export type HakoiriMusumeAnchorPoint = { row: number; column: number };

/**
 * 指の動きをたどる刻み（マス幅に対する割合）。前の位置から今の位置までをこの刻みでたどり、
 * 速く動いた指がイベントの間に通り越したマスも順に拾う。
 */
export const FINGER_TRACE_STEP = 1 / 6;

/**
 * 指のいるマスが隣へ移ったとみなすのに、指が今のマスの中心から半マスを超えて外へ出ていなければならない距離（マス幅に対する割合）。
 * 手ぶれで縁を行き来しても駒が行ったり来たりしないようにする。横と縦で別々に測る。
 */
export const CELL_SWITCH_INSET = 0.15;

/**
 * なぞっている間の状態。
 * - `finger`: 指がいるとみなす、駒の左上のマス。駒が動けなくても指を追う。
 * - `piece`: 駒の左上のマス。
 * - `point`: 最後にたどった指の位置。
 */
export type HakoiriMusumeFingerTrace = {
  finger: HakoiriMusumeCellPosition;
  piece: HakoiriMusumeCellPosition;
  point: HakoiriMusumeAnchorPoint;
};

/** 押したときの、なぞりの始まりの状態。指も駒も、駒の左上のマスにいる。 */
export function startHakoiriMusumeFingerTrace(
  piece: HakoiriMusumeCellPosition,
): HakoiriMusumeFingerTrace {
  return { finger: piece, piece, point: piece };
}

/** 指の座標 `value` が、マス `start` の中心から半マスと `CELL_SWITCH_INSET` 以上外へ出た向き。出ていなければ 0。 */
function findSwitchOffset(value: number, start: number): -1 | 0 | 1 {
  if (value <= start - 0.5 - CELL_SWITCH_INSET) {
    return -1;
  }
  if (value >= start + 0.5 + CELL_SWITCH_INSET) {
    return 1;
  }
  return 0;
}

function clamp(value: number, maximum: number): number {
  return Math.min(Math.max(value, 0), maximum);
}

/**
 * 指がいるとみなすマスを、`point` へ向けて横・縦それぞれ1マスまで移す。
 * 箱の外の指は、駒の左上が取れる範囲の端にいるとみなす。
 */
function followFinger(
  kind: HakoiriMusumePieceKind,
  finger: HakoiriMusumeCellPosition,
  point: HakoiriMusumeAnchorPoint,
): HakoiriMusumeCellPosition {
  const shape = hakoiriMusumePieceShapes[kind];
  return {
    row: clamp(
      finger.row + findSwitchOffset(point.row, finger.row),
      HAKOIRI_MUSUME_ROWS - shape.rows,
    ),
    column: clamp(
      finger.column + findSwitchOffset(point.column, finger.column),
      HAKOIRI_MUSUME_COLUMNS - shape.columns,
    ),
  };
}

function isSamePosition(
  left: HakoiriMusumeCellPosition,
  right: HakoiriMusumeCellPosition,
): boolean {
  return left.row === right.row && left.column === right.column;
}

/**
 * 駒を、指のいるマスへ近づける。指のマスが隣で、置けるときだけ1マス移る。
 * 斜め隣なら、横と縦のうち指が大きく動いた向きの角を先に通り、角と指のマスの両方に置ける角を選ぶ。
 * どちらの角を通っても指のマスに置けなければ、置ける角まで進む。2マス以上離れた指には、駒は動かない（回り込ませない）。
 */
function stepPieceTowardFinger(
  piece: HakoiriMusumeCellPosition,
  finger: HakoiriMusumeCellPosition,
  horizontalFirst: boolean,
  canPlace: HakoiriMusumePlacementCheck,
): HakoiriMusumeCellPosition[] {
  const rowOffset = finger.row - piece.row;
  const columnOffset = finger.column - piece.column;
  if (Math.abs(rowOffset) > 1 || Math.abs(columnOffset) > 1) {
    return [];
  }
  if (rowOffset === 0 || columnOffset === 0) {
    return canPlace(finger) ? [finger] : [];
  }
  const horizontalCorner = {
    row: piece.row,
    column: piece.column + columnOffset,
  };
  const verticalCorner = { row: piece.row + rowOffset, column: piece.column };
  const corners = horizontalFirst
    ? [horizontalCorner, verticalCorner]
    : [verticalCorner, horizontalCorner];
  const throughCorner = corners.find(
    (corner) => canPlace(corner) && canPlace(finger),
  );
  if (throughCorner) {
    return [throughCorner, finger];
  }
  const reachableCorner = corners.find(canPlace);
  return reachableCorner ? [reachableCorner] : [];
}

/**
 * 指が `trace.point` から `to` へ動いた間に、駒が順に移った左上のマスと、動いた後の状態。
 * ほかの駒はなぞっている間は動かないので、`canPlace` は押したときに作ったものを使い続ける。
 */
export function traceHakoiriMusumeFinger(
  kind: HakoiriMusumePieceKind,
  trace: HakoiriMusumeFingerTrace,
  to: HakoiriMusumeAnchorPoint,
  canPlace: HakoiriMusumePlacementCheck,
): { trace: HakoiriMusumeFingerTrace; steps: HakoiriMusumeCellPosition[] } {
  const from = trace.point;
  const rowDelta = to.row - from.row;
  const columnDelta = to.column - from.column;
  const sampleCount = Math.max(
    1,
    Math.ceil(Math.hypot(rowDelta, columnDelta) / FINGER_TRACE_STEP),
  );
  const horizontalFirst = Math.abs(columnDelta) >= Math.abs(rowDelta);
  const steps: HakoiriMusumeCellPosition[] = [];
  let { finger, piece } = trace;
  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const ratio = sample / sampleCount;
    finger = followFinger(kind, finger, {
      row: from.row + rowDelta * ratio,
      column: from.column + columnDelta * ratio,
    });
    if (isSamePosition(finger, piece)) {
      continue;
    }
    const moved = stepPieceTowardFinger(
      piece,
      finger,
      horizontalFirst,
      canPlace,
    );
    steps.push(...moved);
    piece = moved.at(-1) ?? piece;
  }
  return { trace: { finger, piece, point: to }, steps };
}

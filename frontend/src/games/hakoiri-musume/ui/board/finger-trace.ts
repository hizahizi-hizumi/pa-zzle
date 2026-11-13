import {
  type HakoiriMusumeBoardSize,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import type {
  HakoiriMusumeDirection,
  HakoiriMusumePlacementCheck,
} from "@/games/hakoiri-musume/puzzle/rules";

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
 * 箱の外の指は、駒の左上が取れる範囲（駒の形の外接矩形が盤に収まる範囲）の端にいるとみなす。
 */
function followFinger(
  size: HakoiriMusumeBoardSize,
  kind: HakoiriMusumePieceKind,
  finger: HakoiriMusumeCellPosition,
  point: HakoiriMusumeAnchorPoint,
): HakoiriMusumeCellPosition {
  const shape = hakoiriMusumePieceShapes[kind];
  return {
    row: clamp(
      finger.row + findSwitchOffset(point.row, finger.row),
      size.rows - shape.rows,
    ),
    column: clamp(
      finger.column + findSwitchOffset(point.column, finger.column),
      size.columns - shape.columns,
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
  size: HakoiriMusumeBoardSize,
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
    finger = followFinger(size, kind, finger, {
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

/**
 * 駒を指へ寄せて見せる距離の上限（マス幅に対する割合）。指が隣のマスへ移ったとみなす所と同じにして、駒が途中で止まって
 * 移るときに跳ばないよう、指から離れずにマスを移って見せる。
 */
export const FINGER_LEAN_LIMIT = 0.5 + CELL_SWITCH_INSET;

/** 駒を指へ寄せて見せる向き（横か縦）。 */
export type HakoiriMusumeLeanAxis = "row" | "column";

/**
 * 寄せる向きを、前に寄せていた向きから替えるのに、新しい向きの指のずれが前の向きのずれをこれだけ上回らなければならない量
 * （マス幅に対する割合）。斜めになぞったときに、寄せる向きが行き来してちらつかないようにする。
 */
export const LEAN_AXIS_SWITCH_MARGIN = 0.15;

/**
 * 駒を指へ寄せて見せる、マスからのずれ（マス幅を 1 とする）と、寄せた向き。駒の置き場所と手は変えず、見せ方だけを指へ連続して
 * つなぐ。横か縦の一方にだけ、その向きの隣のマスに置けるときに `FINGER_LEAN_LIMIT` までずらす。
 * - 置ける向きが1つなら、その向きへ寄せる（指が大きく離れている向きがふさがれていても、空いた向きへ寄せる）。
 * - 両方の向きに置けるなら、前に寄せていた向き `previousAxis` を保ち、もう一方の向きのずれが `LEAN_AXIS_SWITCH_MARGIN` を超えて
 *   大きくなったときだけ替える。前の向きが無ければ、指が大きく離れている向き。
 * - どちらにも寄せられなければ寄せない（向きは `null`）。
 */
export function leanHakoiriMusumePieceTowardFinger(
  piece: HakoiriMusumeCellPosition,
  anchor: HakoiriMusumeAnchorPoint,
  canPlace: HakoiriMusumePlacementCheck,
  previousAxis: HakoiriMusumeLeanAxis | null = null,
): { lean: HakoiriMusumeAnchorPoint; axis: HakoiriMusumeLeanAxis | null } {
  const deltas = {
    row: anchor.row - piece.row,
    column: anchor.column - piece.column,
  };
  const isOpen = (axis: HakoiriMusumeLeanAxis) => {
    const delta = deltas[axis];
    if (delta === 0) {
      return false;
    }
    const sign = Math.sign(delta);
    return canPlace(
      axis === "row"
        ? { row: piece.row + sign, column: piece.column }
        : { row: piece.row, column: piece.column + sign },
    );
  };
  const open = (["column", "row"] as const).filter(isOpen);
  let axis: HakoiriMusumeLeanAxis | null = open[0] ?? null;
  if (open.length === 2) {
    const larger =
      Math.abs(deltas.column) >= Math.abs(deltas.row) ? "column" : "row";
    const other = previousAxis === "row" ? "column" : "row";
    axis =
      previousAxis === null
        ? larger
        : Math.abs(deltas[other]) >
            Math.abs(deltas[previousAxis]) + LEAN_AXIS_SWITCH_MARGIN
          ? other
          : previousAxis;
  }
  if (axis === null) {
    return { lean: { row: 0, column: 0 }, axis: null };
  }
  const delta = deltas[axis];
  const lean = Math.sign(delta) * Math.min(Math.abs(delta), FINGER_LEAN_LIMIT);
  return {
    lean: axis === "row" ? { row: lean, column: 0 } : { row: 0, column: lean },
    axis,
  };
}

/** 指の位置と、その位置を読んだ時刻（ms）。 */
export type HakoiriMusumeTimedPoint = HakoiriMusumeAnchorPoint & {
  timeMs: number;
};

/** 弾いた手とみなす、離すまでの指の動きの長さの下限（マス幅に対する割合）。ほかのゲームの短いスワイプと同じくらいの長さ。 */
const FLICK_MIN_DISTANCE = 0.2;
/**
 * 弾いた手とみなす、離す前の指の速さの下限（マス幅 / ms）。0.1 秒で 0.15 マス（iPhone の縦の画面で約 120px/s）。
 * 止めてから離した指は、離す前の速さがほぼ 0 なので当たらない。
 */
const FLICK_MIN_SPEED = 0.0015;
/** 離す前の指の速さを測る長さ（ms）。 */
const FLICK_SPEED_WINDOW_MS = 80;
/** 弾いた向きとみなすのに、主な向きの動きが、それと直交する向きの動きの何倍以上あればよいか。 */
const FLICK_AXIS_RATIO = 2;

/**
 * 駒をマスへ移さないまま速く弾いて離した指の、弾いた向き。弾いた手でなければ `null`。
 * `down` は押した位置、`recentPath` は押した後に読んだ最近の指の位置を古い順に並べたもので、末尾は離した位置。
 * 押した位置から離した位置までの動きが一つの向きに `FLICK_MIN_DISTANCE` 以上あり、離す前の `FLICK_SPEED_WINDOW_MS` の
 * 速さがその向きに `FLICK_MIN_SPEED` 以上あるときだけ、弾いた手とみなす。
 */
export function findHakoiriMusumeFlickDirection(
  down: HakoiriMusumeTimedPoint,
  recentPath: readonly HakoiriMusumeTimedPoint[],
): HakoiriMusumeDirection | null {
  const up = recentPath.at(-1);
  if (!up) {
    return null;
  }
  const rowDelta = up.row - down.row;
  const columnDelta = up.column - down.column;
  const horizontal = Math.abs(columnDelta) >= Math.abs(rowDelta);
  const major = horizontal ? columnDelta : rowDelta;
  const minor = horizontal ? rowDelta : columnDelta;
  if (
    Math.abs(major) < FLICK_MIN_DISTANCE ||
    Math.abs(major) < Math.abs(minor) * FLICK_AXIS_RATIO
  ) {
    return null;
  }
  const windowStart =
    recentPath.findLast(
      (point) => point.timeMs <= up.timeMs - FLICK_SPEED_WINDOW_MS,
    ) ?? down;
  const elapsedMs = up.timeMs - windowStart.timeMs;
  const recentMajor = horizontal
    ? up.column - windowStart.column
    : up.row - windowStart.row;
  if (
    elapsedMs <= 0 ||
    Math.sign(recentMajor) !== Math.sign(major) ||
    Math.abs(recentMajor) / elapsedMs < FLICK_MIN_SPEED
  ) {
    return null;
  }
  if (horizontal) {
    return major > 0 ? "right" : "left";
  }
  return major > 0 ? "down" : "up";
}

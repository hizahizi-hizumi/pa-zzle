import {
  areHitofudePuzzleCellsAdjacent,
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  isHitofudePuzzleCellOnBoard,
  isHitofudePuzzleHole,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  getHitofudePuzzleHead,
  type HitofudePuzzlePuzzleState,
} from "@/games/hitofude-puzzle/puzzle/state";

/** `not-adjacent`: 先端の上下左右に隣り合わないマス（先端そのものを含む）。 */
export type HitofudePuzzleExtensionRejection =
  | "outside-board"
  | "not-adjacent"
  | "hole"
  | "visited";

export type HitofudePuzzleExtension =
  | { kind: "extended"; state: HitofudePuzzlePuzzleState }
  | { kind: "rejected"; reason: HitofudePuzzleExtensionRejection };

export type HitofudePuzzleHeadMove =
  | { kind: "extended"; state: HitofudePuzzlePuzzleState }
  | { kind: "retracted"; state: HitofudePuzzlePuzzleState }
  | { kind: "rejected"; reason: HitofudePuzzleExtensionRejection };

function findExtensionRejection(
  board: HitofudePuzzleBoard,
  state: HitofudePuzzlePuzzleState,
  cell: number,
): HitofudePuzzleExtensionRejection | null {
  const head = getHitofudePuzzleHead(state);
  if (!isHitofudePuzzleCellOnBoard(board.size, cell)) {
    return "outside-board";
  }
  if (!areHitofudePuzzleCellsAdjacent(board.size, head, cell)) {
    return "not-adjacent";
  }
  if (isHitofudePuzzleHole(board, cell)) {
    return "hole";
  }
  if (state.path.includes(cell)) {
    return "visited";
  }
  return null;
}

export function extendHitofudePuzzle(
  board: HitofudePuzzleBoard,
  state: HitofudePuzzlePuzzleState,
  cell: number,
): HitofudePuzzleExtension {
  const rejection = findExtensionRejection(board, state, cell);
  if (rejection !== null) {
    return { kind: "rejected", reason: rejection };
  }
  return { kind: "extended", state: { path: [...state.path, cell] } };
}

export function retractHitofudePuzzle(
  state: HitofudePuzzlePuzzleState,
): HitofudePuzzlePuzzleState {
  if (state.path.length <= 1) {
    return state;
  }
  return { path: state.path.slice(0, -1) };
}

export function rewindHitofudePuzzle(
  state: HitofudePuzzlePuzzleState,
  cell: number,
): HitofudePuzzlePuzzleState {
  const position = state.path.indexOf(cell);
  if (position < 0 || position === state.path.length - 1) {
    return state;
  }
  return { path: state.path.slice(0, position + 1) };
}

/** ドラッグと矢印キーで道を引くときの1マスぶんの操作。道の途中のマスへの移動は巻き戻さない。 */
export function moveHitofudePuzzleHead(
  board: HitofudePuzzleBoard,
  state: HitofudePuzzlePuzzleState,
  cell: number,
): HitofudePuzzleHeadMove {
  if (state.path.length >= 2 && state.path.at(-2) === cell) {
    return { kind: "retracted", state: retractHitofudePuzzle(state) };
  }
  return extendHitofudePuzzle(board, state, cell);
}

/**
 * - `extended`: 道が1マス以上延びた。
 * - `unchanged`: 道を変えない（先端・道の途中のマスに入った、道から外れた指が動いた、など）。
 * - `rejected`: 先端から進もうとした指が穴に阻まれた。
 */
export type HitofudePuzzleTrace =
  | { kind: "extended"; state: HitofudePuzzlePuzzleState }
  | { kind: "retracted"; state: HitofudePuzzlePuzzleState }
  | { kind: "unchanged" }
  | { kind: "rejected"; reason: HitofudePuzzleExtensionRejection };

/** 指が `from` から `to` へ移った向き。斜めや一直線に離れたマスをつなぐ順を決める。 */
export type HitofudePuzzleTraceStep = {
  from: number;
  to: number;
  /** 横の動きの方が大きいか。斜めに移ったとき、横に隣のマスを先に通る。 */
  horizontalFirst: boolean;
};

/** 先端から `to` まで、指が通り越したマスを順に並べる。斜め1マスは角のマスを、一直線なら間のマスを通る。 */
function listCellsTowards(
  size: number,
  head: number,
  to: number,
  horizontalFirst: boolean,
): number[][] {
  const { row: headRow, column: headColumn } = getHitofudePuzzleCellPosition(
    size,
    head,
  );
  const { row, column } = getHitofudePuzzleCellPosition(size, to);
  const rowDelta = row - headRow;
  const columnDelta = column - headColumn;
  if (Math.abs(rowDelta) === 1 && Math.abs(columnDelta) === 1) {
    const horizontalCorner = headRow * size + column;
    const verticalCorner = row * size + headColumn;
    const corners = horizontalFirst
      ? [horizontalCorner, verticalCorner]
      : [verticalCorner, horizontalCorner];
    return corners.map((corner) => [corner, to]);
  }
  if (rowDelta !== 0 && columnDelta !== 0) {
    return [];
  }
  const distance = Math.abs(rowDelta) + Math.abs(columnDelta);
  const stride = Math.sign(rowDelta) * size + Math.sign(columnDelta);
  return [
    Array.from({ length: distance }, (_, index) => head + stride * (index + 1)),
  ];
}

function extendThrough(
  board: HitofudePuzzleBoard,
  state: HitofudePuzzlePuzzleState,
  cells: readonly number[],
): HitofudePuzzlePuzzleState | null {
  let current = state;
  for (const cell of cells) {
    const extension = extendHitofudePuzzle(board, current, cell);
    if (extension.kind === "rejected") {
      return null;
    }
    current = extension.state;
  }
  return current;
}

/**
 * なぞる指が `from` のマスから `to` のマスへ移ったときに道を変える。
 * - 直前のマスへ入ると1マス縮める。先端から2つ前のマスへ移ったときは、延ばすときに角や間のマスを通るのと同じく
 *   直前のマスを通って戻ったとみなし、2マス縮める。道の途中のそれ以外のマスへ入っても巻き戻さない。
 * - 先端に隣り合う未通過マスへ入ると延ばす。指が道から外れていても、先端の隣へ戻れば延ばす。
 * - 先端から離れたマスへは、指が先端から移ったときだけ、通り越したマスを通って延ばす。
 *   斜めは穴でない角のマスを通り、通れる道筋が無ければ延ばさない。
 * - 阻まれたことを返すのは、指が先端から穴へ移ったときだけ。
 *   道から外れた指が動き続けても、同じ障害を何度も返さない。
 */
export function traceHitofudePuzzle(
  board: HitofudePuzzleBoard,
  state: HitofudePuzzlePuzzleState,
  { from, to, horizontalFirst }: HitofudePuzzleTraceStep,
): HitofudePuzzleTrace {
  const head = getHitofudePuzzleHead(state);
  const movedFromHead = from === head;
  if (state.path.length >= 2 && state.path.at(-2) === to) {
    return { kind: "retracted", state: retractHitofudePuzzle(state) };
  }
  if (movedFromHead && state.path.length >= 3 && state.path.at(-3) === to) {
    return { kind: "retracted", state: { path: state.path.slice(0, -2) } };
  }
  if (!isHitofudePuzzleCellOnBoard(board.size, to) || state.path.includes(to)) {
    return { kind: "unchanged" };
  }
  if (areHitofudePuzzleCellsAdjacent(board.size, head, to)) {
    const extension = extendHitofudePuzzle(board, state, to);
    if (extension.kind === "extended") {
      return extension;
    }
    return movedFromHead ? extension : { kind: "unchanged" };
  }
  if (!movedFromHead) {
    return { kind: "unchanged" };
  }
  for (const cells of listCellsTowards(board.size, head, to, horizontalFirst)) {
    const extended = extendThrough(board, state, cells);
    if (extended !== null) {
      return { kind: "extended", state: extended };
    }
  }
  return { kind: "unchanged" };
}

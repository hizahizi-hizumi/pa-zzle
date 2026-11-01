import {
  areHamiltonianPathCellsAdjacent,
  getHamiltonianPathCellPosition,
  type HamiltonianPathBoard,
  isHamiltonianPathCellOnBoard,
  isHamiltonianPathHole,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  getHamiltonianPathHead,
  type HamiltonianPathPuzzleState,
} from "@/games/hamiltonian-path/puzzle/state";

/**
 * 道を延ばせなかった理由。
 * - `outside-board`: 枠の外のマス。
 * - `not-adjacent`: 先端の上下左右に隣り合わないマス（先端そのものを含む）。
 * - `hole`: 穴。
 * - `visited`: 道がもう通ったマス。
 */
export type HamiltonianPathExtensionRejection =
  | "outside-board"
  | "not-adjacent"
  | "hole"
  | "visited";

export type HamiltonianPathExtension =
  | { kind: "extended"; state: HamiltonianPathPuzzleState }
  | { kind: "rejected"; reason: HamiltonianPathExtensionRejection };

/**
 * 先端を隣のマスへ動かした結果。`retracted` は直前のマスへ戻って道が1マス縮んだこと。
 * `rejected` の理由は `HamiltonianPathExtension` と同じ。
 */
export type HamiltonianPathHeadMove =
  | { kind: "extended"; state: HamiltonianPathPuzzleState }
  | { kind: "retracted"; state: HamiltonianPathPuzzleState }
  | { kind: "rejected"; reason: HamiltonianPathExtensionRejection };

function findExtensionRejection(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathExtensionRejection | null {
  const head = getHamiltonianPathHead(state);
  if (!isHamiltonianPathCellOnBoard(board.size, cell)) {
    return "outside-board";
  }
  if (!areHamiltonianPathCellsAdjacent(board.size, head, cell)) {
    return "not-adjacent";
  }
  if (isHamiltonianPathHole(board, cell)) {
    return "hole";
  }
  if (state.path.includes(cell)) {
    return "visited";
  }
  return null;
}

/** 先端から隣のマスへ道を1マス延ばす。 */
export function extendHamiltonianPath(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathExtension {
  const rejection = findExtensionRejection(board, state, cell);
  if (rejection !== null) {
    return { kind: "rejected", reason: rejection };
  }
  return { kind: "extended", state: { path: [...state.path, cell] } };
}

/** 先端を1マス戻す。道が始点だけなら同じ状態を返す。 */
export function retractHamiltonianPath(
  state: HamiltonianPathPuzzleState,
): HamiltonianPathPuzzleState {
  if (state.path.length <= 1) {
    return state;
  }
  return { path: state.path.slice(0, -1) };
}

/** 道の途中のマス（始点を含む）まで巻き戻し、そのマスを先端にする。道に無いマスや先端なら同じ状態を返す。 */
export function rewindHamiltonianPath(
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathPuzzleState {
  const position = state.path.indexOf(cell);
  if (position < 0 || position === state.path.length - 1) {
    return state;
  }
  return { path: state.path.slice(0, position + 1) };
}

/**
 * 先端を隣のマスへ動かす。直前のマスへ動かすと道が1マス縮み、それ以外は道を延ばす。
 * ドラッグと矢印キーで道を引くときの1マスぶんの操作。道の途中のマスへの移動は巻き戻さない。
 */
export function moveHamiltonianPathHead(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathHeadMove {
  if (state.path.length >= 2 && state.path.at(-2) === cell) {
    return { kind: "retracted", state: retractHamiltonianPath(state) };
  }
  return extendHamiltonianPath(board, state, cell);
}

/**
 * なぞる指が隣のマスへ移ったときの道の変化。
 * - `extended`: 道が1マス以上延びた。
 * - `retracted`: 直前のマスへ戻って道が1マス縮んだ。
 * - `unchanged`: 道を変えない（先端・道の途中のマスに入った、道から外れた指が動いた、など）。
 * - `rejected`: 先端から進もうとした指が穴に阻まれた。
 */
export type HamiltonianPathTrace =
  | { kind: "extended"; state: HamiltonianPathPuzzleState }
  | { kind: "retracted"; state: HamiltonianPathPuzzleState }
  | { kind: "unchanged" }
  | { kind: "rejected"; reason: HamiltonianPathExtensionRejection };

/** 指が `from` から `to` へ移った向き。斜めや一直線に離れたマスをつなぐ順を決める。 */
export type HamiltonianPathTraceStep = {
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
  const { row: headRow, column: headColumn } = getHamiltonianPathCellPosition(
    size,
    head,
  );
  const { row, column } = getHamiltonianPathCellPosition(size, to);
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
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cells: readonly number[],
): HamiltonianPathPuzzleState | null {
  let current = state;
  for (const cell of cells) {
    const extension = extendHamiltonianPath(board, current, cell);
    if (extension.kind === "rejected") {
      return null;
    }
    current = extension.state;
  }
  return current;
}

/**
 * なぞる指が `from` のマスから `to` のマスへ移ったときに道を変える。
 * - 直前のマスへ入ると1マス縮める。道の途中のそれ以外のマスへ入っても巻き戻さない。
 * - 先端に隣り合う未通過マスへ入ると延ばす。指が道から外れていても、先端の隣へ戻れば延ばす。
 * - 先端から離れたマスへは、指が先端から移ったときだけ、通り越したマスを通って延ばす。
 *   斜めは穴でない角のマスを通り、通れる道筋が無ければ延ばさない。
 * - 阻まれたことを返すのは、指が先端から穴へ移ったときだけ。
 *   道から外れた指が動き続けても、同じ障害を何度も返さない。
 */
export function traceHamiltonianPath(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  { from, to, horizontalFirst }: HamiltonianPathTraceStep,
): HamiltonianPathTrace {
  const head = getHamiltonianPathHead(state);
  const movedFromHead = from === head;
  if (state.path.length >= 2 && state.path.at(-2) === to) {
    return { kind: "retracted", state: retractHamiltonianPath(state) };
  }
  if (
    !isHamiltonianPathCellOnBoard(board.size, to) ||
    state.path.includes(to)
  ) {
    return { kind: "unchanged" };
  }
  if (areHamiltonianPathCellsAdjacent(board.size, head, to)) {
    const extension = extendHamiltonianPath(board, state, to);
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

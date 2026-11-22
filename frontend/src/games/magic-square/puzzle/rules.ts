import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  isMagicSquareCellIndex,
  isMagicSquareValue,
  listMagicSquareLines,
  type MagicSquareBoard,
  type MagicSquareCell,
  type MagicSquareLine,
} from "@/games/magic-square/puzzle/board";
import type {
  MagicSquareMemo,
  MagicSquareState,
} from "@/games/magic-square/puzzle/state";

/**
 * 今の盤面だけから決まる列の状態。答えとは照合しない。
 * - `incomplete`: 空きがあり、今の合計はそろえる合計に届いていない。
 * - `matched`: 埋まって、そろえる合計と一致した。
 * - `unmatched`: 埋まったのに、そろえる合計と違う。
 * - `overreached`: 空きがあるのに、今の合計がそろえる合計に届いた・超えた。空きには1以上が入るので、もうそろわない。
 */
export type MagicSquareLineStatus =
  | "incomplete"
  | "matched"
  | "unmatched"
  | "overreached";

/**
 * 数の欄の1つの数の今の状態。
 * - `available`: まだどこにも置いていない。
 * - `selected`: 選んだマスに置いてある。押すとそのマスから外す。
 * - `used`: ほかのマス（最初から置いてある数のマスを含む）に置いてある。押せない。
 */
export type MagicSquareValueState = "available" | "selected" | "used";

export type MagicSquareLineEvaluation = {
  line: MagicSquareLine;
  /** 列に置いてある数の合計。空きは数えない。 */
  sum: number;
  emptyCount: number;
  status: MagicSquareLineStatus;
};

export function isMagicSquareGivenCell(
  givens: MagicSquareBoard,
  cellIndex: number,
): boolean {
  return (givens.cells[cellIndex] ?? null) !== null;
}

/** その数を置いてあるマス。どこにも置いていなければ `null`。 */
export function findMagicSquareValueCell(
  board: MagicSquareBoard,
  value: number,
): number | null {
  const cellIndex = board.cells.indexOf(value);
  return cellIndex < 0 ? null : cellIndex;
}

/** 盤面に置いてある数（最初から置いてある数を含む）。 */
export function listMagicSquareUsedValues(
  board: MagicSquareBoard,
): ReadonlySet<number> {
  return new Set(board.cells.filter((cell) => cell !== null));
}

function isEditableCell(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
): boolean {
  return (
    isMagicSquareCellIndex(state.size, cellIndex) &&
    !isMagicSquareGivenCell(givens, cellIndex)
  );
}

/** 1 から n² までの数ごとの状態。並びは数の小さい順。 */
export function listMagicSquareValueStates(
  givens: MagicSquareBoard,
  board: MagicSquareBoard,
  selectedCellIndex: number | null,
): MagicSquareValueState[] {
  const cellByValue = new Map(
    board.cells.flatMap((cell, cellIndex) =>
      cell === null ? [] : [[cell, cellIndex] as const],
    ),
  );
  return Array.from(
    { length: getMagicSquareMaxValue(board.size) },
    (_, index): MagicSquareValueState => {
      const cellIndex = cellByValue.get(index + 1);
      if (cellIndex === undefined) {
        return "available";
      }
      return cellIndex === selectedCellIndex &&
        !isMagicSquareGivenCell(givens, cellIndex)
        ? "selected"
        : "used";
    },
  );
}

/** 空いているか別の数を置いたマスに、まだどこにも置いていない数を置けるか。最初から置いてある数のマスは変えられない。 */
export function canPlaceMagicSquareValue(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
  value: number,
): boolean {
  return (
    isEditableCell(givens, state, cellIndex) &&
    isMagicSquareValue(state.size, value) &&
    findMagicSquareValueCell(state, value) === null
  );
}

function withCell(
  cells: readonly MagicSquareCell[],
  cellIndex: number,
  cell: MagicSquareCell,
): MagicSquareCell[] {
  const next = [...cells];
  next[cellIndex] = cell;
  return next;
}

/** 数を1回しか使えないので、置いた数はどのマスの候補にも残らない。 */
function removeValueFromMemos(
  memos: readonly MagicSquareMemo[],
  value: number,
): readonly MagicSquareMemo[] {
  return memos.some((memo) => memo.includes(value))
    ? memos.map((memo) =>
        memo.includes(value) ? memo.filter((note) => note !== value) : memo,
      )
    : memos;
}

/**
 * 数を置く。別の数を置いていたマスでは置き換える。置いた数は全部のマスのメモから消す。
 * 置けないとき（`canPlaceMagicSquareValue` が偽）は、受け取った状態をそのまま返す。
 */
export function placeMagicSquareValue(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
  value: number,
): MagicSquareState {
  if (!canPlaceMagicSquareValue(givens, state, cellIndex, value)) {
    return state;
  }
  return {
    ...state,
    cells: withCell(state.cells, cellIndex, value),
    memos: removeValueFromMemos(state.memos, value),
  };
}

/** 置いた数を外す。空きマスと最初から置いてある数のマスでは、受け取った状態をそのまま返す。 */
export function removeMagicSquareValue(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
): MagicSquareState {
  if (
    !isEditableCell(givens, state, cellIndex) ||
    state.cells[cellIndex] === null
  ) {
    return state;
  }
  return { ...state, cells: withCell(state.cells, cellIndex, null) };
}

/**
 * 数の欄で押した数を入れる。そのマスに同じ数が置いてあれば外し、違えば置く（置き換える）。
 * 入れられないときは、受け取った状態をそのまま返す。
 */
export function enterMagicSquareValue(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
  value: number,
): MagicSquareState {
  return state.cells[cellIndex] === value
    ? removeMagicSquareValue(givens, state, cellIndex)
    : placeMagicSquareValue(givens, state, cellIndex, value);
}

/** 空きマスのメモに数を書けるか。盤面に置いてある数は、もうほかのマスの候補にならないので書けない。 */
export function canToggleMagicSquareMemo(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
  value: number,
): boolean {
  return (
    isEditableCell(givens, state, cellIndex) &&
    state.cells[cellIndex] === null &&
    isMagicSquareValue(state.size, value) &&
    findMagicSquareValueCell(state, value) === null
  );
}

/** 空きマスのメモに数を書く。書いてあれば消す。書けないときは、受け取った状態をそのまま返す。 */
export function toggleMagicSquareMemo(
  givens: MagicSquareBoard,
  state: MagicSquareState,
  cellIndex: number,
  value: number,
): MagicSquareState {
  if (!canToggleMagicSquareMemo(givens, state, cellIndex, value)) {
    return state;
  }
  const memo = state.memos[cellIndex] ?? [];
  const nextMemo = memo.includes(value)
    ? memo.filter((note) => note !== value)
    : [...memo, value].sort((left, right) => left - right);
  return {
    ...state,
    memos: state.memos.map((current, index) =>
      index === cellIndex ? nextMemo : current,
    ),
  };
}

function getLineStatus(
  sum: number,
  emptyCount: number,
  magicSum: number,
): MagicSquareLineStatus {
  if (emptyCount === 0) {
    return sum === magicSum ? "matched" : "unmatched";
  }
  return sum >= magicSum ? "overreached" : "incomplete";
}

export function evaluateMagicSquareLine(
  board: MagicSquareBoard,
  line: MagicSquareLine,
): MagicSquareLineEvaluation {
  const cells = getMagicSquareLineCellIndices(board.size, line).map(
    (cellIndex) => board.cells[cellIndex] ?? null,
  );
  const sum = cells.reduce<number>((total, cell) => total + (cell ?? 0), 0);
  const emptyCount = cells.filter((cell) => cell === null).length;
  return {
    line,
    sum,
    emptyCount,
    status: getLineStatus(sum, emptyCount, getMagicSquareMagicSum(board.size)),
  };
}

/** 並びは `listMagicSquareLines` と同じ。 */
export function listMagicSquareLineEvaluations(
  board: MagicSquareBoard,
): MagicSquareLineEvaluation[] {
  return listMagicSquareLines(board.size).map((line) =>
    evaluateMagicSquareLine(board, line),
  );
}

export function isMagicSquareLineViolation(
  status: MagicSquareLineStatus,
): boolean {
  return status === "unmatched" || status === "overreached";
}

/** 全部のマスが埋まり、全部の列がそろえる合計と一致したか。 */
export function isMagicSquareSolved(board: MagicSquareBoard): boolean {
  const filled = board.cells.every(
    (cell) => cell !== null && isMagicSquareValue(board.size, cell),
  );
  return (
    filled &&
    listMagicSquareUsedValues(board).size === board.cells.length &&
    listMagicSquareLineEvaluations(board).every(
      ({ status }) => status === "matched",
    )
  );
}

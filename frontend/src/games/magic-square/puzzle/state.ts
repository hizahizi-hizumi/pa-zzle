import type {
  MagicSquareBoard,
  MagicSquareCell,
} from "@/games/magic-square/puzzle/board";

/** 1つのマスの候補のメモ。小さい順に並べる。 */
export type MagicSquareMemo = readonly number[];

/**
 * 解いている途中の状態。`cells` は最初から置いてある数を含む今の盤面、`memos` はマスごとの候補のメモ。
 * 数を置いたマスのメモは消さずに持ち、そのマスの数を外すとまた見えるようにする。
 */
export type MagicSquareState = MagicSquareBoard & {
  memos: readonly MagicSquareMemo[];
};

const noMemo: MagicSquareMemo = [];

export function createMagicSquareInitialState(
  givens: MagicSquareBoard,
): MagicSquareState {
  return {
    size: givens.size,
    cells: givens.cells,
    memos: givens.cells.map(() => noMemo),
  };
}

function isSameList<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

export function isSameMagicSquareState(
  left: MagicSquareState,
  right: MagicSquareState,
): boolean {
  return (
    left.size === right.size &&
    isSameList<MagicSquareCell>(left.cells, right.cells) &&
    left.memos.length === right.memos.length &&
    left.memos.every((memo, cellIndex) =>
      isSameList(memo, right.memos[cellIndex] ?? noMemo),
    )
  );
}

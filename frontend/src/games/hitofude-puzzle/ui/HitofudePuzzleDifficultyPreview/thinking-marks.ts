import {
  listHitofudePuzzleStalls,
  measureHitofudePuzzleLookaheadLoad,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";

/** 印どうし・印と始点は、上下左右斜めに隣り合わないマスへ置く（マス2つ分の印が重ならない間隔）。 */
const MARK_SPACING = 2;

function measureChebyshevDistance(
  size: number,
  left: number,
  right: number,
): number {
  const a = getHitofudePuzzleCellPosition(size, left);
  const b = getHitofudePuzzleCellPosition(size, right);
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.column - b.column));
}

/** マスの組の重心に最も近いマスから順に並べる。同じ近さならマスの番号の順。 */
function sortByDistanceFrom(
  size: number,
  cells: readonly number[],
  anchorCells: readonly number[],
): number[] {
  const positions = anchorCells.map((cell) =>
    getHitofudePuzzleCellPosition(size, cell),
  );
  const anchor =
    positions.length === 0
      ? { row: (size - 1) / 2, column: (size - 1) / 2 }
      : {
          row:
            positions.reduce((sum, { row }) => sum + row, 0) / positions.length,
          column:
            positions.reduce((sum, { column }) => sum + column, 0) /
            positions.length,
        };
  const distance = (cell: number) => {
    const { row, column } = getHitofudePuzzleCellPosition(size, cell);
    return (row - anchor.row) ** 2 + (column - anchor.column) ** 2;
  };
  return [...cells].sort(
    (left, right) => distance(left) - distance(right) || left - right,
  );
}

/**
 * 難易度選択の見本に置く「考えどころ」の印のマス。
 * 人間向け解法器が局所の推論（角・通路・袋小路・輪にしない）だけでは進めなくなった局面（`listHitofudePuzzleStalls`）ごとに、
 * その局面を抜けて決まった辺の近くへ印を置く。長い先読みで抜けた局面には、先読みの重さ
 * （`measureHitofudePuzzleLookaheadLoad`）と同じだけ印を足す。局所の推論だけで道が決まる盤面には印が無い。
 * 印は、盤面の端の行・列を除き、ほかの印と始点に隣り合わないマスのうち、決まった辺に最も近いマスへ置く。
 * 置けなければ端の行・列、始点との間隔の順にあきらめ、それでも置けなければ空いているマスへ置く。
 */
export function placeHitofudePuzzleThinkingMarks(
  board: HitofudePuzzleBoard,
): number[] {
  const { size } = board;
  const openCells = listHitofudePuzzleOpenCells(board);
  const placed: number[] = [];
  // 印はマスより大きいので、盤面の端の行・列より内側を先に選び、盤面の外形に重ねない。
  const isInner = (cell: number) => {
    const { row, column } = getHitofudePuzzleCellPosition(size, cell);
    return row > 0 && row < size - 1 && column > 0 && column < size - 1;
  };
  const isApart = (cell: number, others: readonly number[]) =>
    others.every(
      (other) => measureChebyshevDistance(size, cell, other) >= MARK_SPACING,
    );
  for (const { decidedEdges, refutationLength } of listHitofudePuzzleStalls(
    board,
  )) {
    const markCount = measureHitofudePuzzleLookaheadLoad(1, refutationLength);
    const candidates = sortByDistanceFrom(size, openCells, [
      ...new Set(decidedEdges.flat()),
    ]);
    for (let mark = 0; mark < markCount; mark += 1) {
      const cell =
        candidates.find(
          (cell) => isInner(cell) && isApart(cell, [...placed, board.start]),
        ) ??
        candidates.find((cell) => isApart(cell, [...placed, board.start])) ??
        candidates.find((cell) => isApart(cell, placed)) ??
        candidates.find((cell) => !placed.includes(cell));
      if (cell !== undefined) {
        placed.push(cell);
      }
    }
  }
  return placed;
}

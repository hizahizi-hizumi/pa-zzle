import { nonogramSolveCell } from "@/games/nonogram/problem/generation/line-solver";
import {
  createUnknownNonogramSolveGrid,
  type NonogramSolveGrid,
  propagateNonogramLineReadings,
} from "@/games/nonogram/problem/generation/propagation";
import type { NonogramClues } from "@/games/nonogram/puzzle/clue";

/**
 * - `complete`: 解を `solutionLimit` 個見つけたか、探索し尽くした。
 * - `aborted`: 探索の節点が `searchNodeLimit` を超えて打ち切った。
 *
 * `searchNodeCount` は「線の読みを固定点まで進め、決まらなければ1マスを仮に決めて分ける」を行った回数。
 * 打ち切った探索では、上限を超えた1回も数える。
 */
export type NonogramSolutionCount = {
  status: "complete" | "aborted";
  solutionCount: number;
  searchNodeCount: number;
};

export type NonogramSolutionSearchLimits = {
  solutionLimit: number;
  searchNodeLimit: number;
};

const defaultLimits: NonogramSolutionSearchLimits = {
  solutionLimit: 2,
  searchNodeLimit: 20_000,
};

/**
 * ヒントに合う解を数える。仮に決めるマスは行優先で最初の未確定マスで、黒を先に試す。
 * 問題の採否には使わず、線の読みだけで解ける問題の解がただ1つであることを確かめるのに使う。
 */
export function countNonogramSolutions(
  clues: NonogramClues,
  limits: Partial<NonogramSolutionSearchLimits> = {},
): NonogramSolutionCount {
  const { solutionLimit, searchNodeLimit } = { ...defaultLimits, ...limits };
  let solutionCount = 0;
  let searchNodeCount = 0;
  let aborted = false;

  function search(grid: NonogramSolveGrid): void {
    if (solutionCount >= solutionLimit || aborted) {
      return;
    }
    searchNodeCount += 1;
    if (searchNodeCount > searchNodeLimit) {
      aborted = true;
      return;
    }
    const status = propagateNonogramLineReadings(clues, grid);
    if (status === "contradicted") {
      return;
    }
    if (status === "complete") {
      solutionCount += 1;
      return;
    }
    const branchCellIndex = grid.cells.indexOf(nonogramSolveCell.unknown);
    for (const value of [nonogramSolveCell.black, nonogramSolveCell.white]) {
      const cells = [...grid.cells];
      cells[branchCellIndex] = value;
      search({ ...grid, cells });
    }
  }

  search(
    createUnknownNonogramSolveGrid({
      width: clues.columns.length,
      height: clues.rows.length,
    }),
  );
  return {
    status: aborted ? "aborted" : "complete",
    solutionCount,
    searchNodeCount,
  };
}

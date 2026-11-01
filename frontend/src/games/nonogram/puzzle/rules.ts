import {
  getNonogramLineCellStates,
  listNonogramLines,
  type NonogramBoard,
  type NonogramCellState,
} from "@/games/nonogram/puzzle/board";
import {
  areSameNonogramClue,
  computeNonogramLineClue,
  type NonogramClue,
  type NonogramClues,
} from "@/games/nonogram/puzzle/clue";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";

/** 行ヒントと同じ順の行ごとの値と、列ヒントと同じ順の列ごとの値。 */
export type NonogramLineFlags = {
  rows: boolean[];
  columns: boolean[];
};

/**
 * 塗ったマスの並びがヒントにちょうど合っているか。未確定と × はどちらも塗っていないマスとして扱う。
 * 今の盤面だけから決まり、解とは照らさない。
 */
export function isNonogramLineMatched(
  clue: NonogramClue,
  states: readonly NonogramCellState[],
): boolean {
  return areSameNonogramClue(
    computeNonogramLineClue(states.map((state) => state === "filled")),
    clue,
  );
}

export function findNonogramMatchedLines(
  board: NonogramBoard,
  clues: NonogramClues,
): NonogramLineFlags {
  const matched: NonogramLineFlags = { rows: [], columns: [] };
  for (const line of listNonogramLines(board)) {
    const clue =
      (line.axis === "row" ? clues.rows : clues.columns)[line.index] ?? [];
    const lineMatched = isNonogramLineMatched(
      clue,
      getNonogramLineCellStates(board, line),
    );
    (line.axis === "row" ? matched.rows : matched.columns).push(lineMatched);
  }
  return matched;
}

/** 塗ったマスの集合が図柄の黒マスと一致したらクリア。× や未確定が残っていてもよい。 */
export function isNonogramSolved(
  board: NonogramBoard,
  solution: NonogramPattern,
): boolean {
  return (
    board.width === solution.width &&
    board.height === solution.height &&
    board.cells.every(
      (state, cellIndex) =>
        (state === "filled") === (solution.black[cellIndex] === true),
    )
  );
}

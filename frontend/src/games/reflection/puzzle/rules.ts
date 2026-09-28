import {
  countReflectionBoardPieces,
  isSameReflectionInventory,
  type ReflectionBoard,
  type ReflectionInventory,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
  isSameReflectionClue,
  type ReflectionClue,
} from "@/games/reflection/puzzle/laser";

/** 盤面が揃えるべき目標。手持ちのピースと外周ヒント。 */
export type ReflectionTarget = {
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
};

/**
 * 手持ちのピースをすべて置き、全外周ヒントが目標と一致していればクリア。
 * 問題は一意解なので、正解配置とのマスごとの比較は要らない。
 */
export function isReflectionSolved(
  board: ReflectionBoard,
  target: ReflectionTarget,
): boolean {
  return (
    isSameReflectionInventory(
      countReflectionBoardPieces(board),
      target.inventory,
    ) && areSameReflectionClues(computeReflectionClues(board), target.clues)
  );
}

/**
 * 外周ヒントごとに、今の配置での光の結果（行き先と通るマスの数）が目標と一致しているか。
 * 並びは `listReflectionEntries` に従う。ピースを置き切っていなくても、その時点の光で判定する。
 */
export function listReflectionClueMatches(
  board: ReflectionBoard,
  clues: readonly ReflectionClue[],
): boolean[] {
  const current = computeReflectionClues(board);
  return clues.map(function matchClue(clue, index) {
    const actual = current[index];
    return actual !== undefined && isSameReflectionClue(actual, clue);
  });
}

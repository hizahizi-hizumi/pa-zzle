import {
  countReflectionBoardPieces,
  isSameReflectionInventory,
  type ReflectionBoard,
  type ReflectionInventory,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
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

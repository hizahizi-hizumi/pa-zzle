import {
  countReflectionBoardPieces,
  isSameReflectionInventory,
  type ReflectionBoard,
  type ReflectionInventory,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
  getReflectionEntryIndex,
  isSameReflectionClue,
  listReflectionEntries,
  type ReflectionClue,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";

export type ReflectionTarget = {
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
};

/** 問題は一意解なので、正解配置とのマスごとの比較は要らない。 */
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
 * 光路は逆にたどれるので、正解の盤面で A から入った光が B から n マスで出るなら、B の目標も「退出 n マス」になる。
 * 出た先の目標が違えば、数と種類がたまたま同じでも正解の光路ではないので一致としない。
 */
export function isReflectionClueMatch(
  clues: readonly ReflectionClue[],
  index: number,
  actual: ReflectionClue,
  /** 光が出た外周位置の `listReflectionEntries` での番号（吸収では `null`、反射では `index` と同じ）。 */
  exitIndex: number | null,
): boolean {
  const clue = clues[index];
  if (clue === undefined || !isSameReflectionClue(actual, clue)) {
    return false;
  }
  if (actual.outcome !== "exit") {
    return true;
  }
  const exitClue = exitIndex === null ? undefined : clues[exitIndex];
  return exitClue !== undefined && isSameReflectionClue(exitClue, clue);
}

export function listReflectionClueMatches(
  board: ReflectionBoard,
  clues: readonly ReflectionClue[],
): boolean[] {
  return listReflectionEntries(board.size).map(
    function matchClue(entry, index) {
      const trace = traceReflectionLaser(board, entry);
      return isReflectionClueMatch(
        clues,
        index,
        trace,
        trace.exit === null
          ? null
          : getReflectionEntryIndex(board.size, trace.exit),
      );
    },
  );
}

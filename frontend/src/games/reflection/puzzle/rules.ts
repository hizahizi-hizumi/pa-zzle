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
 * 外周ヒント `index` から入れた今の光が、その外周ヒントと一致しているか。
 * 行き先の種類と通るマスの数が目標と同じで、退出では出た先の外周ヒントの目標も同じ「退出・同じマスの数」であること。
 * 光路は逆にたどれるので、正解の盤面で A から入った光が B から n マスで出るなら、B の目標も「退出 n マス」になる。
 * 出た先の目標が違えば、数と種類がたまたま同じでも正解の光路ではないので一致としない。
 * `exitIndex` は光が出た外周位置の `listReflectionEntries` での番号（吸収では `null`、反射では `index` と同じ）。
 */
export function isReflectionClueMatch(
  clues: readonly ReflectionClue[],
  index: number,
  actual: ReflectionClue,
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

/**
 * 外周ヒントごとに、今の配置での光が一致しているか（`isReflectionClueMatch`）。
 * 並びは `listReflectionEntries` に従う。ピースを置き切っていなくても、その時点の光で判定する。
 */
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

import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  findIceFloorMazePoolEntryByProblemId,
  type IceFloorMazePooledProblem,
  listIceFloorMazePoolEntries,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで、盤面そのものと最少手数を持つため、プレイ時には生成・難易度分析を走らせない。
 */
export function selectIceFloorMazeProblemForDifficulty(
  difficulty: IceFloorMazeDifficulty,
  seed: ProblemSeed,
): IceFloorMazePooledProblem {
  const entry = selectProblemPoolEntry(
    listIceFloorMazePoolEntries(difficulty),
    seed,
    `level ${difficulty} ice floor maze`,
  );
  return restoreIceFloorMazePoolEntry(entry);
}

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectIceFloorMazeProblemById(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): IceFloorMazePooledProblem | null {
  const entry = findIceFloorMazePoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreIceFloorMazePoolEntry(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectIceFloorMazeProblemById(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): boolean {
  return findIceFloorMazePoolEntryByProblemId(difficulty, problemId) !== null;
}

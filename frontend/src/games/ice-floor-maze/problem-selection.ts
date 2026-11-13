import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  findIceFloorMazePoolEntryByProblemId,
  type IceFloorMazePooledProblem,
  listIceFloorMazePoolEntries,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/** 問題集は生成時に難易度を判定済みで、盤面そのものと最少手数を持つため、プレイ時には生成・難易度分析を走らせない。 */
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

export function selectIceFloorMazeProblemById(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): IceFloorMazePooledProblem | null {
  const entry = findIceFloorMazePoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreIceFloorMazePoolEntry(entry) : null;
}

export function canSelectIceFloorMazeProblemById(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): boolean {
  return findIceFloorMazePoolEntryByProblemId(difficulty, problemId) !== null;
}

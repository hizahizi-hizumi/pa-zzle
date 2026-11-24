import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  findShuttleParkingPoolEntryByProblemId,
  listShuttleParkingPoolEntries,
  restoreShuttleParkingPoolEntry,
  type ShuttleParkingPooledProblem,
} from "@/games/shuttle-parking/problem/problem-pool";

/** 問題集はレベルごとに分けて持ち、問題そのものを符号で持つため、プレイ時には生成・難易度分析を走らせない。 */
export function selectShuttleParkingProblemForDifficulty(
  difficulty: ShuttleParkingDifficulty,
  seed: ProblemSeed,
): ShuttleParkingPooledProblem {
  const entry = selectProblemPoolEntry(
    listShuttleParkingPoolEntries(difficulty),
    seed,
    `level ${difficulty} shuttle parking`,
  );
  return restoreShuttleParkingPoolEntry(entry);
}

export function selectShuttleParkingProblemById(
  difficulty: ShuttleParkingDifficulty,
  problemId: string,
): ShuttleParkingPooledProblem | null {
  const entry = findShuttleParkingPoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreShuttleParkingPoolEntry(entry) : null;
}

export function canSelectShuttleParkingProblemById(
  difficulty: ShuttleParkingDifficulty,
  problemId: string,
): boolean {
  return findShuttleParkingPoolEntryByProblemId(difficulty, problemId) !== null;
}

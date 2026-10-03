import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  type ParkingJamRestoredProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  findParkingJamPoolEntryByProblemId,
  listParkingJamPoolEntries,
  type ParkingJamProblemPoolEntry,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

// 問題集は生成時に難易度を判定済みのため、プレイ時には可解性・難易度の解析を走らせない。
function restorePoolEntry(
  entry: ParkingJamProblemPoolEntry,
): ParkingJamRestoredProblem {
  return restoreParkingJamProblemWithoutAnalysis(
    toParkingJamPoolIdentity(entry),
  );
}

/** 難易度の問題集から seed で1問を選んで復元する。 */
export function selectParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamRestoredProblem {
  const entry = selectProblemPoolEntry(
    listParkingJamPoolEntries(difficulty),
    seed,
    `level ${difficulty} parking jam`,
  );
  return restorePoolEntry(entry);
}

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectParkingJamProblemById(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): ParkingJamRestoredProblem | null {
  const entry = findParkingJamPoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectParkingJamProblemById(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): boolean {
  return findParkingJamPoolEntryByProblemId(difficulty, problemId) !== null;
}

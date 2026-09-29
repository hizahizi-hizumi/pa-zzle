import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  type ParkingJamRestoredProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  listParkingJamPoolEntries,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選んで復元する。
 * 問題集は生成時に難易度を判定済みのため、プレイ時には可解性・難易度の解析を走らせない。
 */
export function selectParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamRestoredProblem {
  const entry = selectProblemPoolEntry(
    listParkingJamPoolEntries(difficulty),
    seed,
    `level ${difficulty} parking jam`,
  );

  return restoreParkingJamProblemWithoutAnalysis(
    toParkingJamPoolIdentity(entry),
  );
}

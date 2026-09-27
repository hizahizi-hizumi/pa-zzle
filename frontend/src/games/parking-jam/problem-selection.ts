import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  type ParkingJamRestoredProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  listParkingJamPoolEntries,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";

/**
 * 難易度の問題集から seed で1問を選んで復元する。
 * 問題集は生成時に難易度を判定済みのため、プレイ時には可解性・難易度の解析を走らせない。
 */
export function selectParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamRestoredProblem {
  const entries = listParkingJamPoolEntries(difficulty);
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (!entry) {
    throw new Error(`No level ${difficulty} parking jam problem is available`);
  }

  return restoreParkingJamProblemWithoutAnalysis(
    toParkingJamPoolIdentity(entry),
  );
}

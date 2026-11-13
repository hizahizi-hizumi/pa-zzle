import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { restoreParkingJamProblemWithoutAnalysis } from "@/games/parking-jam/problem/generator";
import type { ParkingJamIdentifiedProblem } from "@/games/parking-jam/problem/problem";
import {
  findParkingJamPoolEntryByProblemId,
  listParkingJamPoolEntries,
  type ParkingJamProblemPoolEntry,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

function restorePoolEntry(
  entry: ParkingJamProblemPoolEntry,
): ParkingJamIdentifiedProblem {
  return restoreParkingJamProblemWithoutAnalysis(
    toParkingJamPoolIdentity(entry),
  );
}

export function selectParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamIdentifiedProblem {
  const entry = selectProblemPoolEntry(
    listParkingJamPoolEntries(difficulty),
    seed,
    `level ${difficulty} parking jam`,
  );
  return restorePoolEntry(entry);
}

export function selectParkingJamProblemById(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): ParkingJamIdentifiedProblem | null {
  const entry = findParkingJamPoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(entry) : null;
}

export function canSelectParkingJamProblemById(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): boolean {
  return findParkingJamPoolEntryByProblemId(difficulty, problemId) !== null;
}

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamGenerationConditions,
  type ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import problemPoolJson from "@/games/parking-jam/problem/problem-pool.json";
import { createProblemPoolIdLookup } from "@/games/problem-id";

/** 問題集が参照する生成条件。`ParkingJamGenerationConditions` の各値を定義順に並べる。 */
export type ParkingJamProblemPoolConditions = readonly [
  width: number,
  height: number,
  vehicleCount: number,
  roadOpeningCount: number,
  roadOpeningSpan: number,
  fixedAreaCount: number,
  fixedAreaLength: number,
  blockingPlacementProbability: number,
];

/**
 * 事前生成した問題集の1問。生成条件は問題集の条件表の番号で持ち、
 * seed は候補番号から `createParkingJamPoolSeed` で再構成する。
 */
export type ParkingJamProblemPoolEntry = readonly [
  conditionIndex: number,
  candidateIndex: number,
  generationAttempt: number,
];

export type ParkingJamProblemPool = {
  generatorVersion: typeof PARKING_JAM_GENERATOR_VERSION;
  difficultyModelVersion: string;
  conditions: readonly ParkingJamProblemPoolConditions[];
  levels: Record<ParkingJamDifficulty, readonly ParkingJamProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as ParkingJamProblemPool;

export function createParkingJamPoolSeed(candidateIndex: number): string {
  return `pj-pool-${candidateIndex}`;
}

export function toParkingJamPoolConditions(
  conditions: ParkingJamGenerationConditions,
): ParkingJamProblemPoolConditions {
  return [
    conditions.width,
    conditions.height,
    conditions.vehicleCount,
    conditions.roadOpeningCount,
    conditions.roadOpeningSpan,
    conditions.fixedAreaCount,
    conditions.fixedAreaLength,
    conditions.blockingPlacementProbability,
  ];
}

export function createParkingJamPoolIdentity(
  [
    width,
    height,
    vehicleCount,
    roadOpeningCount,
    roadOpeningSpan,
    fixedAreaCount,
    fixedAreaLength,
    blockingPlacementProbability,
  ]: ParkingJamProblemPoolConditions,
  candidateIndex: number,
  generationAttempt: number,
): ParkingJamProblemIdentity {
  return {
    generatorVersion: PARKING_JAM_GENERATOR_VERSION,
    seed: createParkingJamPoolSeed(candidateIndex),
    conditions: {
      width,
      height,
      vehicleCount,
      roadOpeningCount,
      roadOpeningSpan,
      fixedAreaCount,
      fixedAreaLength,
      blockingPlacementProbability,
    },
    generationAttempt,
  };
}

export function toParkingJamPoolIdentity(
  [
    conditionIndex,
    candidateIndex,
    generationAttempt,
  ]: ParkingJamProblemPoolEntry,
  pool: ParkingJamProblemPool = problemPool,
): ParkingJamProblemIdentity {
  const conditions = pool.conditions[conditionIndex];
  if (!conditions) {
    throw new RangeError(
      `Unknown parking jam problem pool condition: ${conditionIndex}`,
    );
  }
  return createParkingJamPoolIdentity(
    conditions,
    candidateIndex,
    generationAttempt,
  );
}

export function listParkingJamPoolEntries(
  difficulty: ParkingJamDifficulty,
): readonly ParkingJamProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  (entry) => toParkingJamPoolIdentity(entry),
);

/**
 * 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。
 * seed（`pj-pool-<候補番号>`）は生成条件ごとの系列なので問題集の中で一意でなく、問題 ID は生成条件も含む identity 全体から求める。
 */
export function findParkingJamPoolEntryByProblemId(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): ParkingJamProblemPoolEntry | null {
  return findPoolPositionByProblemId(difficulty, problemId)?.entry ?? null;
}

export function getParkingJamProblemPoolDifficultyModelVersion(): string {
  return problemPool.difficultyModelVersion;
}

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamGenerationConditions,
  type ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import problemPoolJson from "@/games/parking-jam/problem/problem-pool.json";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/** `ParkingJamGenerationConditions` の各値を定義順に並べる。 */
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

/** 生成条件は問題集の条件表の番号で持ち、seed は候補番号から `createParkingJamPoolSeed` で再構成する。 */
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

const poolIndex = createProblemPoolIndex(problemPool.levels, (entry) =>
  toParkingJamPoolIdentity(entry),
);

export function listParkingJamPoolProblemIds(
  difficulty: ParkingJamDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** seed（`pj-pool-<候補番号>`）は生成条件ごとの系列なので問題集の中で一意でなく、問題 ID は生成条件も含む identity 全体から求める。 */
export function findParkingJamPoolEntryByProblemId(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): ParkingJamProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

export function getParkingJamProblemPoolDifficultyModelVersion(): string {
  return problemPool.difficultyModelVersion;
}

/** 固定物（植え込み）は、つながった1か所を1つと数える。 */
export type ParkingJamProblemFeatures = {
  rows: number;
  columns: number;
  vehicleCount: number;
  fixedAreaCount: number;
};

export function findParkingJamPoolProblemFeatures(
  difficulty: ParkingJamDifficulty,
  problemId: string,
): ParkingJamProblemFeatures | null {
  const entry = findParkingJamPoolEntryByProblemId(difficulty, problemId);
  if (!entry) {
    return null;
  }
  const { width, height, vehicleCount, fixedAreaCount } =
    toParkingJamPoolIdentity(entry).conditions;
  return { rows: height, columns: width, vehicleCount, fixedAreaCount };
}

export const parkingJamProblemFeatureAxes = [
  {
    id: "parking-lot-size",
    getValue({ rows, columns }) {
      return createBoardSizeFeatureValue(rows, columns);
    },
  },
  {
    id: "vehicle-count",
    getValue({ vehicleCount }) {
      return createCountFeatureValue(vehicleCount);
    },
  },
  {
    id: "fixed-area-count",
    getValue({ fixedAreaCount }) {
      return createCountFeatureValue(fixedAreaCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<ParkingJamProblemFeatures>[];

export type ParkingJamProblemFeatureAxisId =
  (typeof parkingJamProblemFeatureAxes)[number]["id"];

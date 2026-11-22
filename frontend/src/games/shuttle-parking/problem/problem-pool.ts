import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  restoreShuttleParkingProblem,
  SHUTTLE_PARKING_GENERATOR_VERSION,
  type ShuttleParkingIdentifiedProblem,
  type ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import problemPoolJson from "@/games/shuttle-parking/problem/problem-pool.json";

/** 問題そのものの符号（`ShuttleParkingProblemIdentity` の `seed`）。実行時に生成器を走らせずに問題を復元できる。 */
export type ShuttleParkingProblemPoolEntry = string;

export type ShuttleParkingProblemPool = {
  generatorVersion: typeof SHUTTLE_PARKING_GENERATOR_VERSION;
  levels: Record<
    ShuttleParkingDifficulty,
    readonly ShuttleParkingProblemPoolEntry[]
  >;
};

export type ShuttleParkingPooledProblem = ShuttleParkingIdentifiedProblem;

const problemPool = problemPoolJson as ShuttleParkingProblemPool;

const lotSizePattern = /^([0-9])/;

export function decodeShuttleParkingPoolEntry(
  seed: ShuttleParkingProblemPoolEntry,
): ShuttleParkingProblemIdentity {
  return {
    generatorVersion: SHUTTLE_PARKING_GENERATOR_VERSION,
    seed,
    conditions: { size: Number(lotSizePattern.exec(seed)?.[1]) },
  };
}

export function restoreShuttleParkingPoolEntry(
  entry: ShuttleParkingProblemPoolEntry,
): ShuttleParkingPooledProblem {
  return restoreShuttleParkingProblem(decodeShuttleParkingPoolEntry(entry));
}

export function listShuttleParkingPoolEntries(
  difficulty: ShuttleParkingDifficulty,
): readonly ShuttleParkingProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  decodeShuttleParkingPoolEntry,
);

/** 問題集の並び順で返す。 */
export function listShuttleParkingPoolProblemIds(
  difficulty: ShuttleParkingDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findShuttleParkingPoolEntryByProblemId(
  difficulty: ShuttleParkingDifficulty,
  problemId: string,
): ShuttleParkingProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

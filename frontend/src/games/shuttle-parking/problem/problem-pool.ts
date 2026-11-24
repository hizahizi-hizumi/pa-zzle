import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type {
  SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
  ShuttleParkingDifficulty,
} from "@/games/shuttle-parking/difficulty";
import {
  restoreShuttleParkingProblem,
  SHUTTLE_PARKING_GENERATOR_VERSION,
  type ShuttleParkingIdentifiedProblem,
  type ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import problemPoolJson from "@/games/shuttle-parking/problem/problem-pool.json";

/**
 * 問題集の1問。
 * - `seed`: 問題そのものの符号（`ShuttleParkingProblemIdentity` の `seed`）。実行時に生成器を走らせずに問題を復元できる。
 * - `trapWeight`: どう進めても出会う最も重い罠の重さ（その罠の結果が何人先に出るか。Lv1 は0）。採点の基準時間で読む量に使う。
 *   通常プレイからは難易度の分析を呼ばないので、問題集を作るときに分析した値を持たせる。
 */
export type ShuttleParkingProblemPoolEntry = readonly [
  seed: string,
  trapWeight: number,
];

export type ShuttleParkingProblemPool = {
  generatorVersion: typeof SHUTTLE_PARKING_GENERATOR_VERSION;
  /** 問題集を作ったときの判定モデルの版。判定を変えたら問題集を作り直す。 */
  difficultyModelVersion: typeof SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION;
  levels: Record<
    ShuttleParkingDifficulty,
    readonly ShuttleParkingProblemPoolEntry[]
  >;
};

export type ShuttleParkingPooledProblem = ShuttleParkingIdentifiedProblem & {
  trapWeight: number;
};

const problemPool = problemPoolJson as unknown as ShuttleParkingProblemPool;

export function getShuttleParkingPoolDifficultyModelVersion(): string {
  return problemPool.difficultyModelVersion;
}

const lotSizePattern = /^([0-9])/;

/** 問題の符号から、今の生成器の問題の identity を作る。 */
export function createShuttleParkingSeedIdentity(
  seed: string,
): ShuttleParkingProblemIdentity {
  return {
    generatorVersion: SHUTTLE_PARKING_GENERATOR_VERSION,
    seed,
    conditions: { size: Number(lotSizePattern.exec(seed)?.[1]) },
  };
}

export function restoreShuttleParkingSeed(
  seed: string,
): ShuttleParkingIdentifiedProblem {
  return restoreShuttleParkingProblem(createShuttleParkingSeedIdentity(seed));
}

export function decodeShuttleParkingPoolEntry([
  seed,
]: ShuttleParkingProblemPoolEntry): ShuttleParkingProblemIdentity {
  return createShuttleParkingSeedIdentity(seed);
}

export function restoreShuttleParkingPoolEntry([
  seed,
  trapWeight,
]: ShuttleParkingProblemPoolEntry): ShuttleParkingPooledProblem {
  return { ...restoreShuttleParkingSeed(seed), trapWeight };
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

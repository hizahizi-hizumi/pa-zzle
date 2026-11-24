import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  createMagicSquareSolveWorkload,
  isMagicSquareBoardSize,
  type MAGIC_SQUARE_GENERATOR_VERSION,
  type MagicSquareIdentifiedProblem,
  type MagicSquareProblemIdentity,
  type MagicSquareSolveWorkload,
  restoreMagicSquareProblem,
  summarizeMagicSquareSeed,
} from "@/games/magic-square/problem/problem";
import problemPoolJson from "@/games/magic-square/problem/problem-pool.json";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 問題集の1問。問題の identity の `seed`（記法は `MagicSquareProblemIdentity`）と、基準の読むモデルで読んだ作業の量。
 * 作業の量は基準時間の材料で、プレイ時に読むモデルを動かさずに済むよう、問題集に持たせる。
 */
export type MagicSquareProblemPoolEntry = readonly [
  seed: string,
  stuckPlaceCount: number,
  tier3PlaceCount: number,
  stuckSweepTotal: number,
];

/**
 * 基準の読むモデルで読んだ作業の量。
 * - `stuckPlaceCount`: 1マス空きの列などで置けず、組を交わる列と突き合わせた所の数。
 * - `tier3PlaceCount`: そのうち、3マス空いた列の組を読んだ所の数。
 * - `stuckSweepTotal`: 組を突き合わせた所の巡（候補を絞り直した回数 + 1）の合計。
 */
export type MagicSquareReadingWorkload = {
  stuckPlaceCount: number;
  tier3PlaceCount: number;
  stuckSweepTotal: number;
};

export type MagicSquarePooledProblem = MagicSquareIdentifiedProblem & {
  workload: MagicSquareSolveWorkload;
  readingWorkload: MagicSquareReadingWorkload;
};

type MagicSquareProblemPool = {
  generatorVersion: typeof MAGIC_SQUARE_GENERATOR_VERSION;
  levels: Record<MagicSquareDifficulty, readonly MagicSquareProblemPoolEntry[]>;
};

/**
 * レベルごとの問題。`scripts/generate-magic-square-problem-pool.ts` で作り、どれも完全な解法器で答えが1つで、
 * 読み方の部品の1〜3つの組み合わせの全部でそのレベルになると確かめた。
 */
const problemPool = problemPoolJson as unknown as MagicSquareProblemPool;

export function toMagicSquarePoolIdentity([
  seed,
]: MagicSquareProblemPoolEntry): MagicSquareProblemIdentity {
  const { size } = summarizeMagicSquareSeed(seed);
  if (!isMagicSquareBoardSize(size)) {
    throw new RangeError(`Unsupported magic square pool entry: ${seed}`);
  }
  return {
    generatorVersion: problemPool.generatorVersion,
    seed,
    conditions: { size },
  };
}

export function restoreMagicSquarePoolEntry(
  entry: MagicSquareProblemPoolEntry,
): MagicSquarePooledProblem {
  const identified = restoreMagicSquareProblem(
    toMagicSquarePoolIdentity(entry),
  );
  const [, stuckPlaceCount, tier3PlaceCount, stuckSweepTotal] = entry;
  return {
    ...identified,
    workload: createMagicSquareSolveWorkload(identified.problem),
    readingWorkload: { stuckPlaceCount, tier3PlaceCount, stuckSweepTotal },
  };
}

export function listMagicSquarePoolEntries(
  difficulty: MagicSquareDifficulty,
): readonly MagicSquareProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex<
  MagicSquareDifficulty,
  MagicSquareProblemPoolEntry
>(problemPool.levels, toMagicSquarePoolIdentity);

/** 問題 ID を、問題集の並び順で返す。 */
export function listMagicSquarePoolProblemIds(
  difficulty: MagicSquareDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findMagicSquarePoolEntryByProblemId(
  difficulty: MagicSquareDifficulty,
  problemId: string,
): MagicSquareProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type MagicSquareProblemFeatures = {
  size: number;
  givenCount: number;
};

/** 図鑑の絞り込みでレベルの全問について求めるので、問題を復元せず問題集の項目から数える。 */
export function findMagicSquarePoolProblemFeatures(
  difficulty: MagicSquareDifficulty,
  problemId: string,
): MagicSquareProblemFeatures | null {
  const entry = findMagicSquarePoolEntryByProblemId(difficulty, problemId);
  return entry === null ? null : summarizeMagicSquareSeed(entry[0]);
}

export const magicSquareProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ size }) {
      return createBoardSizeFeatureValue(size, size);
    },
  },
  {
    id: "given-count",
    getValue({ givenCount }) {
      return createCountFeatureValue(givenCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<MagicSquareProblemFeatures>[];

export type MagicSquareProblemFeatureAxisId =
  (typeof magicSquareProblemFeatureAxes)[number]["id"];

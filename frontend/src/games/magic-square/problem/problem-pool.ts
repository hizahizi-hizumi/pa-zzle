import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  createMagicSquareSolveWorkload,
  isMagicSquareBoardSize,
  MAGIC_SQUARE_GENERATOR_VERSION,
  type MagicSquareIdentifiedProblem,
  type MagicSquareProblemIdentity,
  type MagicSquareSolveWorkload,
  restoreMagicSquareProblem,
  summarizeMagicSquareSeed,
} from "@/games/magic-square/problem/problem";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/** 問題集の1問。問題の identity の `seed`（記法は `MagicSquareProblemIdentity`）。 */
export type MagicSquareProblemPoolEntry = string;

export type MagicSquarePooledProblem = MagicSquareIdentifiedProblem & {
  workload: MagicSquareSolveWorkload;
};

/** レベルごとの問題。どれも完全な解法器で答えが1つと確かめ、導入調査の読むモデルでレベルを分類した。 */
const problemPoolLevels = {
  "1": ["0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.6"],
  "2": [
    "0.6.0.13.10.0.0.1.15.0.0.8.5.3.0.0",
    "0.0.0.21.24.0.0.14.0.19.0.0.0.12.7.0.15.9.0.2.1.0.0.10.0",
  ],
  "3": [
    "18.0.0.22.0.0.10.0.0.21.4.7.0.0.6.0.0.0.0.0.5.0.19.0.9",
    "11.16.15.12.0.0.0.4.0.3.0.0.32.0.20.14.0.28.31.0.1.0.10.5.0.26.0.0.25.2.0.0.0.36.7.0",
  ],
  "4": [
    "8.0.5.0.0.0.9.22.0.20.0.0.0.0.0.2.0.0.0.4.24.0.0.0.15",
    "17.30.0.0.11.20.0.23.32.0.0.0.0.8.28.0.0.16.25.0.7.13.31.0.1.0.0.15.21.27.0.0.0.18.19.9",
  ],
  "5": [
    "21.2.18.19.5.0.0.14.0.24.0.12.0.0.9.16.0.17.0.0.13.0.0.8.0",
    "4.0.35.0.0.0.0.0.11.0.33.12.2.0.0.0.0.0.21.28.0.16.18.0.20.0.14.0.22.0.0.0.9.3.27.0",
  ],
} as const satisfies Record<
  MagicSquareDifficulty,
  readonly MagicSquareProblemPoolEntry[]
>;

export function toMagicSquarePoolIdentity(
  entry: MagicSquareProblemPoolEntry,
): MagicSquareProblemIdentity {
  const { size } = summarizeMagicSquareSeed(entry);
  if (!isMagicSquareBoardSize(size)) {
    throw new RangeError(`Unsupported magic square pool entry: ${entry}`);
  }
  return {
    generatorVersion: MAGIC_SQUARE_GENERATOR_VERSION,
    seed: entry,
    conditions: { size },
  };
}

export function restoreMagicSquarePoolEntry(
  entry: MagicSquareProblemPoolEntry,
): MagicSquarePooledProblem {
  const identified = restoreMagicSquareProblem(
    toMagicSquarePoolIdentity(entry),
  );
  return {
    ...identified,
    workload: createMagicSquareSolveWorkload(identified.problem),
  };
}

export function listMagicSquarePoolEntries(
  difficulty: MagicSquareDifficulty,
): readonly MagicSquareProblemPoolEntry[] {
  return problemPoolLevels[difficulty];
}

const poolIndex = createProblemPoolIndex<
  MagicSquareDifficulty,
  MagicSquareProblemPoolEntry
>(problemPoolLevels, toMagicSquarePoolIdentity);

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
  return entry === null ? null : summarizeMagicSquareSeed(entry);
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

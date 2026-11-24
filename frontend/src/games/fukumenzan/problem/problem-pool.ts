import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import {
  assertFukumenzanProblem,
  createFukumenzanProblemIdentity,
  FUKUMENZAN_GENERATOR_VERSION,
  type FukumenzanIdentifiedProblem,
  type FukumenzanProblem,
  type FukumenzanProblemIdentity,
  parseFukumenzanEquation,
} from "@/games/fukumenzan/problem/problem";
import { getFukumenzanEquationStructure } from "@/games/fukumenzan/puzzle/equation";
import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/** 問題集の1問。式の文字列（例 `BYK+KTK=TKHH`）で、identity の `seed` と同じ。 */
export type FukumenzanProblemPoolEntry = string;

export type FukumenzanPooledProblem = FukumenzanIdentifiedProblem;

/** 研究用の難易度判定でそのレベルに入ると確かめた一意解の問題。 */
const problemPool = {
  generatorVersion: FUKUMENZAN_GENERATOR_VERSION,
  levels: {
    "1": ["BYK+KTK=TKHH", "LLJH+LHW=JAWCJ"],
    "2": ["NNV+UFN+NTT=NFVT"],
    "3": ["YFL+YAD+ADY=YLYY", "GHL+LGF+FFF=GHFW"],
    "4": ["GVANK+FFFGB+VWNN=BGAVKB", "DBRPR+UTTDR+UDDP=DDUURJ"],
    "5": ["KBBKC+EAWKB+WWKT=AACEBC", "XXXGN+TPGTN+TXTA=GPAAYP"],
  },
} as const satisfies {
  generatorVersion: typeof FUKUMENZAN_GENERATOR_VERSION;
  levels: Record<FukumenzanDifficulty, readonly FukumenzanProblemPoolEntry[]>;
};

export function decodeFukumenzanPoolProblem(
  entry: FukumenzanProblemPoolEntry,
): FukumenzanProblem {
  const problem = parseFukumenzanEquation(entry);
  if (problem === null) {
    throw new RangeError(`Invalid Fukumenzan pool entry: ${entry}`);
  }
  assertFukumenzanProblem(problem);
  return problem;
}

export function toFukumenzanPoolIdentity(
  entry: FukumenzanProblemPoolEntry,
): FukumenzanProblemIdentity {
  return createFukumenzanProblemIdentity(decodeFukumenzanPoolProblem(entry));
}

export function toFukumenzanPooledProblem(
  entry: FukumenzanProblemPoolEntry,
): FukumenzanPooledProblem {
  const problem = decodeFukumenzanPoolProblem(entry);
  return { problem, identity: createFukumenzanProblemIdentity(problem) };
}

export function listFukumenzanPoolEntries(
  difficulty: FukumenzanDifficulty,
): readonly FukumenzanProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  toFukumenzanPoolIdentity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findFukumenzanPoolEntryByProblemId(
  difficulty: FukumenzanDifficulty,
  problemId: string,
): FukumenzanProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/** identity に一致する問題集の1問を探す。生成器の版が違う identity・問題集に無い identity には `null` を返す。 */
export function findFukumenzanPoolEntry(
  identity: FukumenzanProblemIdentity,
): FukumenzanProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const entries: readonly FukumenzanProblemPoolEntry[] = Object.values(
    problemPool.levels,
  ).flat();
  return entries.find((entry) => entry === identity.seed) ?? null;
}

export function listFukumenzanPoolProblemIds(
  difficulty: FukumenzanDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/**
 * 始めたときの式を見れば分かる、問題の特徴。
 * - `letterCount`: 式に出る文字の種類。
 * - `sameLetterColumnCount`: 答えの行を含めて右をそろえた桁のうち、同じ文字が2回以上出る桁の数。
 */
export type FukumenzanProblemFeatures = {
  letterCount: number;
  sameLetterColumnCount: number;
};

export function measureFukumenzanProblemFeatures(
  problem: FukumenzanProblem,
): FukumenzanProblemFeatures {
  const { letters, columns } = getFukumenzanEquationStructure(problem);
  return {
    letterCount: letters.length,
    sameLetterColumnCount: columns.filter(
      ({ addendLetters, resultLetter }) =>
        new Set([...addendLetters, resultLetter]).size <
        addendLetters.length + 1,
    ).length,
  };
}

/** 難易度の問題集の1問の特徴を求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findFukumenzanPoolProblemFeatures(
  difficulty: FukumenzanDifficulty,
  problemId: string,
): FukumenzanProblemFeatures | null {
  const entry = findFukumenzanPoolEntryByProblemId(difficulty, problemId);
  return entry
    ? measureFukumenzanProblemFeatures(decodeFukumenzanPoolProblem(entry))
    : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。 */
export const fukumenzanProblemFeatureAxes = [
  {
    id: "letter-count",
    getValue({ letterCount }) {
      return createCountFeatureValue(letterCount);
    },
  },
  {
    id: "same-letter-column-count",
    getValue({ sameLetterColumnCount }) {
      return createCountFeatureValue(sameLetterColumnCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<FukumenzanProblemFeatures>[];

export type FukumenzanProblemFeatureAxisId =
  (typeof fukumenzanProblemFeatureAxes)[number]["id"];

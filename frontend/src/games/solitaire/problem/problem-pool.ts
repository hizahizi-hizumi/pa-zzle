import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import {
  restoreSolitaireProblem,
  SOLITAIRE_GENERATOR_VERSION,
  type SolitaireIdentifiedProblem,
  type SolitaireProblem,
  type SolitaireProblemIdentity,
} from "@/games/solitaire/problem/problem";
import {
  getSolitaireCardRank,
  SOLITAIRE_KING_RANK,
} from "@/games/solitaire/puzzle/card";

/** 1問の項目。配った札の符号（identity の `seed`）なので、問題を復元するのに生成器を走らせない。 */
export type SolitaireProblemPoolEntry = string;

/**
 * 各レベルの問題。並びは問題集の並び。
 * 導入調査の難易度の資料（`docs/パズル/導入調査/ソリティア/ソリティア難易度.md` §7）の各レベルの代表の配り方で、
 * 上から調査コード `solitaire_difficulty.py` の deal(3)・deal(170)・deal(354)・deal(315)・deal(352)。
 */
const problemPool: Readonly<
  Record<SolitaireDifficulty, readonly SolitaireProblemPoolEntry[]>
> = {
  "1": ["NcDTdazWkKgGLRhwYfBSFCVsvrpbqUHJZxnMOjQtAuEyoemXIilP"],
  "2": ["GkjiCoEDrMsBJILRqXeZVmScdKObauntzhpfTgYANHxQvPFwUlWy"],
  "3": ["frRCEUydBDYspgVxQIhXnzPwLWZHlctkeajSKibmuOTvAJoGqFMN"],
  "4": ["ZHEwtceIWSRbuiKvOPjLfChTnUxrYdmNMkqBgGoyQJFDplXAVzsa"],
  "5": ["AbWTCjZdrPYhngGXtFoOxUQfkyVDBucamLKspHziNweMlIRqEvJS"],
};

export type SolitairePooledProblem = SolitaireIdentifiedProblem;

export function decodeSolitairePoolEntry(
  entry: SolitaireProblemPoolEntry,
): SolitaireProblemIdentity {
  return {
    generatorVersion: SOLITAIRE_GENERATOR_VERSION,
    seed: entry,
    conditions: {},
  };
}

export function restoreSolitairePoolEntry(
  entry: SolitaireProblemPoolEntry,
): SolitairePooledProblem {
  return restoreSolitaireProblem(decodeSolitairePoolEntry(entry));
}

export function listSolitairePoolEntries(
  difficulty: SolitaireDifficulty,
): readonly SolitaireProblemPoolEntry[] {
  return problemPool[difficulty];
}

const poolIndex = createProblemPoolIndex(problemPool, decodeSolitairePoolEntry);

/** 問題集の並び順で返す。 */
export function listSolitairePoolProblemIds(
  difficulty: SolitaireDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findSolitairePoolEntryByProblemId(
  difficulty: SolitaireDifficulty,
  problemId: string,
): SolitaireProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/**
 * 配った列の28枚を見れば分かる、問題の特徴。どちらも列ごとに数えて足し、同じ札は1回だけ数える。
 * - `cardsAboveAce`: 列の一番奥の A より上（手前）にある札の数。列に A が無ければ 0。
 * - `cardsBelowKing`: 列の一番手前の K より下（奥）にある札の数。列に K が無ければ 0。
 */
export type SolitaireProblemFeatures = {
  cardsAboveAce: number;
  cardsBelowKing: number;
};

export function measureSolitaireProblemFeatures({
  columns,
}: SolitaireProblem): SolitaireProblemFeatures {
  let cardsAboveAce = 0;
  let cardsBelowKing = 0;
  for (const column of columns) {
    const ranks = column.map(getSolitaireCardRank);
    const deepestAce = ranks.indexOf(1);
    const topKing = ranks.lastIndexOf(SOLITAIRE_KING_RANK);
    cardsAboveAce += deepestAce < 0 ? 0 : column.length - 1 - deepestAce;
    cardsBelowKing += Math.max(topKing, 0);
  }
  return { cardsAboveAce, cardsBelowKing };
}

export function findSolitairePoolProblemFeatures(
  difficulty: SolitaireDifficulty,
  problemId: string,
): SolitaireProblemFeatures | null {
  const entry = findSolitairePoolEntryByProblemId(difficulty, problemId);
  return entry
    ? measureSolitaireProblemFeatures(restoreSolitairePoolEntry(entry).problem)
    : null;
}

export const solitaireProblemFeatureAxes = [
  {
    id: "cards-above-ace",
    getValue({ cardsAboveAce }) {
      return createCountFeatureValue(cardsAboveAce);
    },
  },
  {
    id: "cards-below-king",
    getValue({ cardsBelowKing }) {
      return createCountFeatureValue(cardsBelowKing);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<SolitaireProblemFeatures>[];

export type SolitaireProblemFeatureAxisId =
  (typeof solitaireProblemFeatureAxes)[number]["id"];

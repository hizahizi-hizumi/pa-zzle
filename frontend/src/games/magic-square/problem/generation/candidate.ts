import {
  classifyMagicSquareReading,
  MAGIC_SQUARE_SWEEP_LIMIT,
  type MagicSquareDifficulty,
} from "@/games/magic-square/difficulty";
import {
  type MagicSquareReadingFeatures,
  measureMagicSquareReading,
  summarizeMagicSquareReading,
} from "@/games/magic-square/problem/difficulty-analysis";
import {
  createRandomMagicSquare,
  pickMagicSquare4,
} from "@/games/magic-square/problem/generation/answers";
import { readMagicSquare } from "@/games/magic-square/problem/generation/read-model";
import { findMagicSquareReading } from "@/games/magic-square/problem/generation/reading-parts";
import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";
import type { MagicSquareBoardSize } from "@/games/magic-square/problem/problem";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";

/**
 * 候補の作り方。答えの魔方陣から、読むモデル（段 `maxTier` まで）で解ける限りマスを空け、仕上げる。
 * - `add-back`: 空けたマスのうち `count` マスを無作為に戻す（易しめの候補）。
 * - `polish`: 戻さずに、与える数の入れ替え・外す・足すを試し、`target` のレベル向けの点を下げない向きに磨く。
 */
export type MagicSquareCandidateConditions = {
  size: MagicSquareBoardSize;
  maxTier: number;
  finish:
    | { kind: "add-back"; count: number }
    | { kind: "polish"; target: Extract<MagicSquareDifficulty, "4" | "5"> };
};

function formatFinish(
  finish: MagicSquareCandidateConditions["finish"],
): string {
  return finish.kind === "polish"
    ? `polish${finish.target}`
    : `add${finish.count}`;
}

/** 生成条件の名前。例: `5-T3-polish5`（5×5 を段3まで減らし、レベル5向けに磨く）、`4-T2-add1`（4×4 を段2まで減らし、1マス戻す）。 */
export function formatMagicSquareCandidateConditions({
  size,
  maxTier,
  finish,
}: MagicSquareCandidateConditions): string {
  return `${size}-T${maxTier}-${formatFinish(finish)}`;
}

/** 生成条件ごとの `index` 番目の候補の名前。候補の乱数の種にもする。 */
export function formatMagicSquareCandidateId(
  conditions: MagicSquareCandidateConditions,
  index: number,
): string {
  return `ms${formatMagicSquareCandidateConditions(conditions)}-${index}`;
}

/** 候補は、生成条件と候補の番号だけで決まる。 */
export function createMagicSquareCandidateRandom(
  conditions: MagicSquareCandidateConditions,
  index: number,
): ProblemRandom {
  return createProblemSeededRandom(
    formatMagicSquareCandidateId(conditions, index),
  );
}

export type MagicSquareGivensReduction = {
  givens: number[];
  /** 空けると読むモデルで解けなくなったので、戻したマス（空けた順）。 */
  keptCells: number[];
  readCount: number;
};

/** `cellOrder` の順に1マスずつ空け、読むモデル（段 `maxTier` まで）で解けなくなるマスは戻す。 */
export function reduceMagicSquareGivens(
  size: number,
  solution: MagicSquareGrid,
  cellOrder: readonly number[],
  maxTier: number,
): MagicSquareGivensReduction {
  const givens = [...solution];
  const keptCells: number[] = [];
  let readCount = 0;
  for (const cell of cellOrder) {
    const value = givens[cell]!;
    givens[cell] = 0;
    readCount += 1;
    if (readMagicSquare(size, givens, { maxTier }).status !== "solved") {
      givens[cell] = value;
      keptCells.push(cell);
    }
  }
  return { givens, keptCells, readCount };
}

/** 磨く回数。 */
const POLISH_ITERATION_COUNT = 200;
/** 1回の磨きで、与える数を入れ替える割合と、入れ替えか外す割合（残りは足す）。 */
const POLISH_SWAP_RATIO = 0.7;
const POLISH_SWAP_OR_REMOVE_RATIO = 0.9;
/** 磨くときに一致を確かめる読み方で、基準とレベルが違うごとに引く点。 */
const POLISH_DISAGREEMENT_PENALTY = 15;
/** 進まない盤面の点。 */
const POLISH_REJECTED_SCORE = -1e9;

/**
 * 磨くときに一致を確かめる読み方。分類の一致で外れやすい問題を作りにくくするための目安で、分類そのものは部品の1〜3つの
 * 組み合わせの全部で確かめる。
 */
const polishCheckReadingIds = [
  "strong+jointk2_s2",
  "memo4+chain_late",
  "strong+mrange1",
  "lock_eph+weak",
  "memo4+diag_nochain",
  "lock_eph+memo4",
  "tchain_none",
] as const;

function isPolishable(features: MagicSquareReadingFeatures): boolean {
  return (
    features.status === "solved" &&
    features.stuckSweepsMax <= MAGIC_SQUARE_SWEEP_LIMIT &&
    features.tierMax < 4
  );
}

/**
 * L5 向けの点: 入口が無く、最初の所が段3（巡が多いほど高い）で、深い所が多い盤面を高くする。巡が3を超える分と入口は引く。
 */
export function scoreMagicSquarePolishForLevel5(
  features: MagicSquareReadingFeatures,
): number {
  if (!isPolishable(features)) {
    return POLISH_REJECTED_SCORE;
  }
  const firstTier3 = features.firstTier >= 3 ? 1 : 0;
  const lead =
    features.entryCellCount === 0
      ? 6 * firstTier3 + 6 * Math.min(features.firstSweeps, 2) * firstTier3
      : 0;
  return (
    lead +
    4 * Math.min(features.stuckSweepsMax, 3) -
    3 * Math.max(features.stuckSweepsMax - 3, 0) +
    3 * Math.min(features.tier3PlaceCount, 2) +
    2 * Math.min(features.reworkedPlaceCount, 3) +
    Math.min(features.stuckPlaceCount, 6) -
    8 * Math.min(features.entryCellCount, 3)
  );
}

/**
 * L4 向けの点: 入口が無く、最初の所が段2・1巡で、途中に段3の所か段2で4巡以上の所がある盤面を高くする。
 * 最初の所が段3か段2で2巡以上の盤面（L5 の側）は引く。
 */
export function scoreMagicSquarePolishForLevel4(
  features: MagicSquareReadingFeatures,
): number {
  if (!isPolishable(features)) {
    return POLISH_REJECTED_SCORE;
  }
  const lightFirst = features.firstTier === 2 && features.firstSweeps === 1;
  const heavyFirst =
    features.firstTier >= 3 ||
    (features.firstTier === 2 && features.firstSweeps >= 2);
  return (
    (features.entryCellCount === 0 ? 10 : 0) +
    (lightFirst ? 10 : 0) -
    (heavyFirst ? 10 : 0) +
    5 * Math.min(features.tier3PlaceCount, 2) +
    (features.tier2SweepsMax >= 4 ? 4 : 0) +
    2 * Math.min(features.reworkedPlaceCount, 3) +
    Math.min(features.stuckPlaceCount, 6) -
    3 * Math.max(features.stuckSweepsMax - 3, 0) -
    8 * Math.min(features.entryCellCount, 3)
  );
}

/**
 * 磨く点（`features` は段 `maxTier` までで読んだ特徴）から、一致を確かめる読み方で基準とレベル（基準は巡の上限を当て、
 * 読み方は当てない）が違うごとに引いた点。読むモデルを呼んだ回数も返す。
 */
function evaluatePolish(
  size: number,
  givens: MagicSquareGrid,
  features: MagicSquareReadingFeatures,
  target: Extract<MagicSquareDifficulty, "4" | "5">,
): { score: number; readCount: number } {
  const score =
    target === "4"
      ? scoreMagicSquarePolishForLevel4(features)
      : scoreMagicSquarePolishForLevel5(features);
  if (score === POLISH_REJECTED_SCORE) {
    return { score, readCount: 0 };
  }
  const { level } = classifyMagicSquareReading(
    measureMagicSquareReading(size, givens),
    MAGIC_SQUARE_SWEEP_LIMIT,
  );
  const disagreements = polishCheckReadingIds.filter((id) => {
    const reading = findMagicSquareReading(id);
    if (reading === null) {
      throw new Error(`Unknown magic square reading: ${id}`);
    }
    return (
      classifyMagicSquareReading(
        measureMagicSquareReading(size, givens, reading.options),
        null,
      ).level !== level
    );
  }).length;
  return {
    score: score - POLISH_DISAGREEMENT_PENALTY * disagreements,
    readCount: 1 + polishCheckReadingIds.length,
  };
}

/**
 * 与える数の入れ替え（1つ外して別の1マスを与える）・外す・足すを `POLISH_ITERATION_COUNT` 回試し、
 * 読むモデル（段 `maxTier` まで）で解ける盤面のうち、点を下げないものへ進む。
 */
export function polishMagicSquareGivens(
  size: number,
  solution: MagicSquareGrid,
  givens: MagicSquareGrid,
  random: ProblemRandom,
  {
    maxTier,
    target,
  }: { maxTier: number; target: Extract<MagicSquareDifficulty, "4" | "5"> },
): { givens: number[]; readCount: number } {
  let current = [...givens];
  const initial = evaluatePolish(
    size,
    current,
    measureMagicSquareReading(size, current, { maxTier }),
    target,
  );
  let currentScore = initial.score;
  let readCount = 1 + initial.readCount;
  for (let iteration = 0; iteration < POLISH_ITERATION_COUNT; iteration += 1) {
    const givenCells: number[] = [];
    const emptyCells: number[] = [];
    current.forEach((value, cell) => {
      (value ? givenCells : emptyCells).push(cell);
    });
    const next = [...current];
    const choice = random();
    if (
      choice < POLISH_SWAP_RATIO &&
      givenCells.length > 0 &&
      emptyCells.length > 0
    ) {
      next[pickProblemValue(givenCells, random)] = 0;
      const cell = pickProblemValue(emptyCells, random);
      next[cell] = solution[cell]!;
    } else if (choice < POLISH_SWAP_OR_REMOVE_RATIO && givenCells.length > 0) {
      next[pickProblemValue(givenCells, random)] = 0;
    } else if (emptyCells.length > 0) {
      const cell = pickProblemValue(emptyCells, random);
      next[cell] = solution[cell]!;
    }
    const result = readMagicSquare(size, next, { maxTier });
    readCount += 1;
    if (result.status !== "solved") {
      continue;
    }
    const evaluation = evaluatePolish(
      size,
      next,
      summarizeMagicSquareReading(result),
      target,
    );
    readCount += evaluation.readCount;
    if (evaluation.score >= currentScore) {
      current = next;
      currentScore = evaluation.score;
    }
  }
  return { givens: current, readCount };
}

export type MagicSquareCandidate = {
  solution: MagicSquareGrid;
  givens: number[];
  /** 候補を作るのに読むモデルを呼んだ回数。 */
  readCount: number;
};

/** 答えの魔方陣を作り、与える数を減らし、仕上げる。同じ乱数列には同じ候補を返す。 */
export function generateMagicSquareCandidate(
  { size, maxTier, finish }: MagicSquareCandidateConditions,
  random: ProblemRandom,
): MagicSquareCandidate {
  const solution =
    size === 4
      ? pickMagicSquare4(random)
      : createRandomMagicSquare(size, random).square;
  const cellOrder = shuffleProblemValues(
    Array.from({ length: size * size }, (_, cell) => cell),
    random,
  );
  const reduction = reduceMagicSquareGivens(size, solution, cellOrder, maxTier);
  if (finish.kind === "polish") {
    const polished = polishMagicSquareGivens(
      size,
      solution,
      reduction.givens,
      random,
      { maxTier, target: finish.target },
    );
    return {
      solution,
      givens: polished.givens,
      readCount: reduction.readCount + polished.readCount,
    };
  }
  const givens = [...reduction.givens];
  const emptyCells = givens.flatMap((value, cell) => (value ? [] : [cell]));
  for (const cell of shuffleProblemValues(emptyCells, random).slice(
    0,
    finish.count,
  )) {
    givens[cell] = solution[cell]!;
  }
  return { solution, givens, readCount: reduction.readCount };
}

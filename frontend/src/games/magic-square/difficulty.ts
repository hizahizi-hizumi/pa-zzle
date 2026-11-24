import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  MagicSquareDifficultyAnalysis,
  MagicSquareReadingFeatures,
} from "@/games/magic-square/problem/difficulty-analysis";
import type { MagicSquareBoardSize } from "@/games/magic-square/problem/problem";

export type MagicSquareDifficulty = DifficultyLevel;

/** 判定の版。読むモデル・読み方の部品・梯子・作るときの帯・盤面の割り当てを変えたら上げる。 */
export const MAGIC_SQUARE_DIFFICULTY_MODEL_VERSION = "reading-v8";

/**
 * 1か所の巡の上限。基準の読むモデルで測る作り方の決まりで、読み方どうしのレベルを比べるときには当てない。
 * 磨かずに作った段2以上の問題の 95〜98% が収まる長さ（導入調査）。
 */
export const MAGIC_SQUARE_SWEEP_LIMIT = 4;

/** 深い所: 段3以上の所か、段2でこの巡以上の所（3マスの組を読むか、2マスの組を2回以上作り直して初めて決まる所）。 */
const DEEP_PLACE_TIER2_SWEEPS = 3;

/** 空きが4マス以上の列を読む段。この段が要る問題は出さない。 */
const LONG_LINE_TIER = 4;

/**
 * レベルごとの読み（梯子）。上から当てるのではなく、全部の条件が合うレベルを1つ選ぶ。
 * - `entry`: 最初の盤面に、段1の1巡で決まるマス（入口）があるか。
 * - `deepPlace`: 深い所があるか。
 * - `firstPlaceDeep`: 最初の所が深いか。
 * 入口があって深い所もある問題は、どのレベルにも当たらない。
 */
type MagicSquareLevelReading = {
  tierMax: NumericRange;
  entry: boolean;
  deepPlace: boolean;
  firstPlaceDeep: boolean;
};

export const magicSquareLevelReadings = {
  "1": {
    tierMax: { minimum: 1, maximum: 1 },
    entry: true,
    deepPlace: false,
    firstPlaceDeep: false,
  },
  "2": {
    tierMax: { minimum: 2, maximum: 2 },
    entry: true,
    deepPlace: false,
    firstPlaceDeep: false,
  },
  "3": {
    tierMax: { minimum: 2, maximum: 2 },
    entry: false,
    deepPlace: false,
    firstPlaceDeep: false,
  },
  "4": {
    tierMax: { minimum: 2, maximum: 3 },
    entry: false,
    deepPlace: true,
    firstPlaceDeep: false,
  },
  "5": {
    tierMax: { minimum: 2, maximum: 3 },
    entry: false,
    deepPlace: true,
    firstPlaceDeep: true,
  },
} as const satisfies Record<MagicSquareDifficulty, MagicSquareLevelReading>;

/**
 * レベルごとに許す盤面の一辺。上ほど広い盤面を許し、隣のレベルと盤面を重ねる。
 * 4×4 は上のレベルの問題がほとんど作れず、四隅などの合計の近道もあるので、下のレベルだけにする。
 */
export const magicSquareLevelBoardSizes = {
  "1": { minimum: 4, maximum: 4 },
  "2": { minimum: 4, maximum: 5 },
  "3": { minimum: 5, maximum: 6 },
  "4": { minimum: 5, maximum: 6 },
  "5": { minimum: 5, maximum: 6 },
} as const satisfies Record<
  MagicSquareDifficulty,
  NumericRange<MagicSquareBoardSize>
>;

/**
 * 作るときの帯。基準の読むモデルで境目から上下に1段離れた問題だけを作る決まりで、読み方どうしのレベルを比べるときには求めない。
 * 段2の巡で上下に1つずつ余裕を取る（深くない所は段2で1巡、深い所は段3か段2で4巡）。
 * - `tier2SweepsMax`: 段2の所の巡の最大。
 * - `firstPlaces`: 最初の所の段と巡（どれか1つに当たる）。
 * - `deepPlaceTier2Sweeps`: 段3以上の所か、段2でこの巡以上の所がある。
 */
type MagicSquareLevelBand = {
  tier2SweepsMax?: NumericRange;
  firstPlaces?: readonly { tier: number; sweeps: NumericRange }[];
  deepPlaceTier2Sweeps?: number;
};

export const magicSquareLevelBands = {
  "1": {},
  "2": { tier2SweepsMax: { minimum: 0, maximum: 1 } },
  "3": { tier2SweepsMax: { minimum: 0, maximum: 1 } },
  "4": {
    firstPlaces: [{ tier: 2, sweeps: { minimum: 1, maximum: 1 } }],
    deepPlaceTier2Sweeps: 4,
  },
  "5": {
    firstPlaces: [
      { tier: 3, sweeps: { minimum: 2, maximum: Number.POSITIVE_INFINITY } },
      { tier: 2, sweeps: { minimum: 4, maximum: Number.POSITIVE_INFINITY } },
    ],
  },
} as const satisfies Record<MagicSquareDifficulty, MagicSquareLevelBand>;

/** 1つの読み方の特徴だけで決まる、レベルに当たらない理由。 */
type MagicSquareReadingOutOfRangeReason =
  /** 段4まで読んでも決まらない所が残る（試し置きが要る）。 */
  | "requires-trial"
  /** 空きが4マス以上の列を読む段が要る。 */
  | "long-line"
  /** 1か所の巡が上限を超える。 */
  | "too-deep"
  /** 入口があって深い所もある。 */
  | "unlisted-combination"
  /** 読みのレベルはあるが、その盤面を許していない。 */
  | "size-not-allowed"
  /** 4×4 で、仮想の列を足して読むとレベルが下がる。 */
  | "virtual-shortcut";

export type MagicSquareReadingLevel =
  | { level: MagicSquareDifficulty }
  | { level: null; reason: MagicSquareReadingOutOfRangeReason };

export type MagicSquareOutOfRangeReason =
  | MagicSquareReadingOutOfRangeReason
  /** 段1だけで解けるが、与える数が段1で極小でない。 */
  | "not-minimal"
  /** 作るときの帯に入らない。 */
  | "near-boundary"
  /** 読み方の部品の1〜3つの組み合わせのどれかで、基準と違うレベルになる。 */
  | "reading-dependent";

export function hasMagicSquareDeepPlace(
  features: MagicSquareReadingFeatures,
): boolean {
  return (
    features.tier2SweepsMax >= DEEP_PLACE_TIER2_SWEEPS ||
    features.tier3PlaceCount >= 1
  );
}

export function isMagicSquareFirstPlaceDeep(
  features: MagicSquareReadingFeatures,
): boolean {
  return (
    features.firstTier >= 3 ||
    (features.firstTier === 2 &&
      features.firstSweeps >= DEEP_PLACE_TIER2_SWEEPS)
  );
}

function matchesLevelReading(
  features: MagicSquareReadingFeatures,
  level: MagicSquareLevelReading,
): boolean {
  return (
    isInNumericRange(features.tierMax, level.tierMax) &&
    features.entryCellCount >= 1 === level.entry &&
    hasMagicSquareDeepPlace(features) === level.deepPlace &&
    isMagicSquareFirstPlaceDeep(features) === level.firstPlaceDeep
  );
}

/** 1つの読み方の特徴でのレベル（盤面に依らない）。`sweepLimit` が `null` なら巡の上限を当てない。 */
export function classifyMagicSquareReading(
  features: MagicSquareReadingFeatures,
  sweepLimit: number | null,
): MagicSquareReadingLevel {
  if (features.status !== "solved") {
    return { level: null, reason: "requires-trial" };
  }
  if (features.tierMax >= LONG_LINE_TIER) {
    return { level: null, reason: "long-line" };
  }
  if (
    sweepLimit !== null &&
    (features.tier2SweepsMax > sweepLimit ||
      features.tier3SweepsMax > sweepLimit)
  ) {
    return { level: null, reason: "too-deep" };
  }
  const level = difficultyLevels.find(({ id }) =>
    matchesLevelReading(features, magicSquareLevelReadings[id]),
  )?.id;
  return level ? { level } : { level: null, reason: "unlisted-combination" };
}

/**
 * 1つの読み方でのレベル。`boardSize` を渡すと、その盤面を許すレベルかも確かめる。
 * 4×4 は、同じ読み方に仮想の列を足して読む（`measureVirtual`）とレベルが下がる問題を除く。
 */
export function classifyMagicSquareReadingOnBoard(
  features: MagicSquareReadingFeatures,
  measureVirtual: () => MagicSquareReadingFeatures | null,
  {
    sweepLimit,
    boardSize,
  }: { sweepLimit: number | null; boardSize: number | null },
): MagicSquareReadingLevel {
  const reading = classifyMagicSquareReading(features, sweepLimit);
  if (reading.level === null) {
    return reading;
  }
  if (
    boardSize !== null &&
    !isInNumericRange(boardSize, magicSquareLevelBoardSizes[reading.level])
  ) {
    return { level: null, reason: "size-not-allowed" };
  }
  const virtual = measureVirtual();
  if (virtual?.status === "solved") {
    const { level } = classifyMagicSquareReading(virtual, sweepLimit);
    if (level !== null && Number(level) < Number(reading.level)) {
      return { level: null, reason: "virtual-shortcut" };
    }
  }
  return reading;
}

export function isInMagicSquareLevelBand(
  features: MagicSquareReadingFeatures,
  difficulty: MagicSquareDifficulty,
): boolean {
  const band: MagicSquareLevelBand = magicSquareLevelBands[difficulty];
  return (
    (band.tier2SweepsMax === undefined ||
      isInNumericRange(features.tier2SweepsMax, band.tier2SweepsMax)) &&
    (band.firstPlaces === undefined ||
      band.firstPlaces.some(
        ({ tier, sweeps }) =>
          features.firstTier === tier &&
          isInNumericRange(features.firstSweeps, sweeps),
      )) &&
    (band.deepPlaceTier2Sweeps === undefined ||
      features.tier3PlaceCount >= 1 ||
      features.tier2SweepsMax >= band.deepPlaceTier2Sweeps)
  );
}

type AnalyzedMagicSquareDifficulty = Extract<
  MagicSquareDifficultyAnalysis,
  { status: "analyzed" }
>;

/**
 * 部品とその組み合わせ（部品の並び、続けて組み合わせの並び）のうち、基準のレベル `difficulty` と違うレベル（範囲外を含む。
 * 巡の上限は当てない）になる最初の読み方の名前。全部同じなら `null`。違う読み方が見つかった所で読むのをやめる。
 */
export function findMagicSquareDisagreeingReading(
  analysis: AnalyzedMagicSquareDifficulty,
  difficulty: MagicSquareDifficulty,
): string | null {
  for (const reading of analysis.listAlternativeReadings()) {
    const { level } = classifyMagicSquareReadingOnBoard(
      reading.features,
      reading.measureVirtual,
      { sweepLimit: null, boardSize: null },
    );
    if (level !== difficulty) {
      return reading.id;
    }
  }
  return null;
}

/**
 * - `out-of-range`: 答えは1つだが、出さない問題。`reading-dependent` は違うレベルになった最初の読み方を添える。
 * - `invalid`: 答えが無いか2つ以上（完全な解法器の上限に届いたものを含む）。
 * 読むモデルで止まる問題は `requires-trial` と `long-line` に分かれるので、評価できない問題は無い。
 */
export type MagicSquareDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange:
    | { reason: Exclude<MagicSquareOutOfRangeReason, "reading-dependent"> }
    | { reason: "reading-dependent"; readingId: string };
  unsupported: never;
  invalid: NoAssessmentDetail;
}>;

/**
 * 基準の読むモデルでレベルを付け（巡の上限・盤面の割り当て・4×4 の仮想の列を当てる）、L1 は与える数が段1で極小か、
 * L2〜L5 は作るときの帯に入るかを確かめ、最後に読み方の部品の1〜3つの組み合わせの全部で同じレベルになるかを確かめる。
 * 範囲外の理由は、この順で最初に当たったもの。
 */
export function assessMagicSquareDifficulty(
  analysis: MagicSquareDifficultyAnalysis,
): MagicSquareDifficultyAssessment {
  if (analysis.status === "invalid") {
    return { status: "invalid" };
  }
  const { features } = analysis;
  const base = classifyMagicSquareReadingOnBoard(
    features.reading,
    () => features.virtualReading,
    { sweepLimit: MAGIC_SQUARE_SWEEP_LIMIT, boardSize: features.boardSize },
  );
  if (base.level === null) {
    return { status: "out-of-range", reason: base.reason };
  }
  if (base.level === "1" && !features.tier1Minimal) {
    return { status: "out-of-range", reason: "not-minimal" };
  }
  if (!isInMagicSquareLevelBand(features.reading, base.level)) {
    return { status: "out-of-range", reason: "near-boundary" };
  }
  const readingId = findMagicSquareDisagreeingReading(analysis, base.level);
  if (readingId !== null) {
    return { status: "out-of-range", reason: "reading-dependent", readingId };
  }
  return { status: "classified", difficulty: base.level };
}

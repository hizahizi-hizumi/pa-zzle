import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
  type RecordedDifficulty,
} from "@/games/difficulty";
import type {
  ParkingJamDifficultyAnalysis,
  ParkingJamDifficultyFeatures,
} from "@/games/parking-jam/problem/difficulty-analysis";

export type ParkingJamDifficulty = DifficultyLevel;

// 3段階（visual-local-load-v1）時代の記録を、旧区分のまま読み込み表示するためだけに残す。
export type ParkingJamRecordedDifficulty = RecordedDifficulty;

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "challenge-levers-v1";

/** 挑戦を強めるレバーの強さ。1が最も弱い。 */
export type ParkingJamLeverStrength = 1 | 2 | 3;

/**
 * 問題の挑戦を3系統のレバーで表したもの。
 * - `dependency`: 依存の深さ・広さ。塞いでいる車をさらに何段さかのぼって読むか、何台の依存を同時に保つか。
 * - `misread`: 読み違いの誘発。出られそうに見えて不成立になる操作を誘う車の割合。
 * - `scale`: 規模。盤面の広さと、読む対象（車と固定物）の数の弱い方。
 */
export type ParkingJamChallengeLevers = {
  dependency: ParkingJamLeverStrength;
  misread: ParkingJamLeverStrength;
  scale: ParkingJamLeverStrength;
};

// 全車がすぐ出せる、または塞がれた車が1台だけの問題は、出す順序を読む挑戦がほぼない。
const MINIMUM_PROVIDED_DEPENDENCY_DEPTH = 2;
const MINIMUM_PROVIDED_INITIAL_BLOCKED_VEHICLE_COUNT = 2;
// 段数7以上は候補空間の0.1%しか現れず、人が遊んで確かめていないため提供しない。
const MAXIMUM_PROVIDED_DEPENDENCY_DEPTH = 6;

// 境界はすべて人間校正前の暫定値。
const DEPENDENCY_DEEP_DEPTH = 4;
const DEPENDENCY_BRANCHED_DEPTH = 3;
const DEPENDENCY_MINIMUM_BRANCHING = 2;
const DEPENDENCY_MINIMUM_OVERLAP_PREREQUISITE_COUNT = 2;

const MISREAD_STRONG_MINIMUM_RATIO = 1 / 2;
const MISREAD_MODERATE_MINIMUM_RATIO = 1 / 4;

const SCALE_SMALL_MAXIMUM_CELL_COUNT = 36;
const SCALE_MEDIUM_MAXIMUM_CELL_COUNT = 48;
const SCALE_FEW_MAXIMUM_ELEMENT_COUNT = 8;
const SCALE_MODERATE_MAXIMUM_ELEMENT_COUNT = 11;

/**
 * 1: 塞いでいる車はすぐ出せる（段数2で、2台以上を先に出す車がない）。
 * 2: 2台以上を先に出す車がある、または塞いでいる車がさらに塞がれている（段数3で枝分かれ1以下）。
 * 3: 3段以上さかのぼる（段数4以上）、または2段の待ちが枝分かれする（段数3で枝分かれ2以上）。
 * 枝分かれは「最少先行台数の最大 −（段数 − 1）」で、1本の連鎖だけなら0になる。
 */
function classifyDependencyLever(
  dependencyDepth: number,
  maximumPrerequisiteVehicleCount: number,
): ParkingJamLeverStrength {
  const branching = maximumPrerequisiteVehicleCount - (dependencyDepth - 1);
  if (
    dependencyDepth >= DEPENDENCY_DEEP_DEPTH ||
    (dependencyDepth === DEPENDENCY_BRANCHED_DEPTH &&
      branching >= DEPENDENCY_MINIMUM_BRANCHING)
  ) {
    return 3;
  }
  if (
    dependencyDepth === DEPENDENCY_BRANCHED_DEPTH ||
    maximumPrerequisiteVehicleCount >=
      DEPENDENCY_MINIMUM_OVERLAP_PREREQUISITE_COUNT
  ) {
    return 2;
  }
  return 1;
}

/** 読み違いを誘う車が4台に1台未満なら1、2台に1台未満なら2、それ以上なら3。車が多いだけでは上がらない。 */
function classifyMisreadLever(
  misreadInducingVehicleCount: number,
  vehicleCount: number,
): ParkingJamLeverStrength {
  const ratio =
    vehicleCount === 0 ? 0 : misreadInducingVehicleCount / vehicleCount;
  if (ratio >= MISREAD_STRONG_MINIMUM_RATIO) return 3;
  if (ratio >= MISREAD_MODERATE_MINIMUM_RATIO) return 2;
  return 1;
}

/** 盤面の広さと読む対象の数の弱い方。広いだけ・多いだけでは上がらない。 */
function classifyScaleLever(
  boardCellCount: number,
  vehicleCount: number,
  fixedAreaCount: number,
): ParkingJamLeverStrength {
  const areaStrength: ParkingJamLeverStrength =
    boardCellCount <= SCALE_SMALL_MAXIMUM_CELL_COUNT
      ? 1
      : boardCellCount <= SCALE_MEDIUM_MAXIMUM_CELL_COUNT
        ? 2
        : 3;
  const elementCount = vehicleCount + fixedAreaCount;
  const elementStrength: ParkingJamLeverStrength =
    elementCount <= SCALE_FEW_MAXIMUM_ELEMENT_COUNT
      ? 1
      : elementCount <= SCALE_MODERATE_MAXIMUM_ELEMENT_COUNT
        ? 2
        : 3;
  return Math.min(areaStrength, elementStrength) as ParkingJamLeverStrength;
}

/** 状態空間を解析できない問題（車両数が厳密解析の上限を超える）ではレバーを求められない。 */
export function calculateParkingJamChallengeLevers(
  features: ParkingJamDifficultyFeatures,
): ParkingJamChallengeLevers | null {
  if (features.maximumPrerequisiteVehicleCount === null) return null;
  return {
    dependency: classifyDependencyLever(
      features.dependencyDepth,
      features.maximumPrerequisiteVehicleCount,
    ),
    misread: classifyMisreadLever(
      features.misreadInducingVehicleCount,
      features.vehicleCount,
    ),
    scale: classifyScaleLever(
      features.boardCellCount,
      features.vehicleCount,
      features.fixedAreaCount,
    ),
  };
}

type ParkingJamLevelLevers = {
  dependency: ParkingJamLeverStrength;
  misread: ParkingJamLeverStrength;
  /** 規模は単独でレベルを決めないよう、隣のレベルと重なる範囲で許す。 */
  scale: NumericRange<ParkingJamLeverStrength>;
};

/**
 * 各レベルが求めるレバーの組合せ。依存と読み違いを1つずつ交互に上げ、規模の許す範囲の両端も下げない。
 * 上のレベルはどのレバーも下のレベルより弱くならないので、上位は下位の挑戦を含む。
 */
export const parkingJamLevelLevers = {
  "1": { dependency: 1, misread: 1, scale: { minimum: 1, maximum: 2 } },
  "2": { dependency: 1, misread: 2, scale: { minimum: 1, maximum: 2 } },
  "3": { dependency: 2, misread: 2, scale: { minimum: 1, maximum: 3 } },
  "4": { dependency: 2, misread: 3, scale: { minimum: 2, maximum: 3 } },
  "5": { dependency: 3, misread: 3, scale: { minimum: 2, maximum: 3 } },
} as const satisfies Record<ParkingJamDifficulty, ParkingJamLevelLevers>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、レバーの組合せがいずれかのレベルにちょうど当たった。
 * - `out-of-range`: 評価できるが提供しない。出す順序を読む挑戦がほぼない（`too-light`）、
 *   依存が深すぎて確かめていない（`too-heavy`）、レバーの組合せがどのレベルにも当たらない（`unlisted-combination`）。
 * - `unsupported`: 車両数が厳密解析の上限を超え、評価できない。
 */
export type ParkingJamDifficultyAssessment = DifficultyAssessment<{
  classified: { levers: ParkingJamChallengeLevers };
  outOfRange:
    | { reason: "too-light" | "too-heavy" }
    | { reason: "unlisted-combination"; levers: ParkingJamChallengeLevers };
  unsupported: NoAssessmentDetail;
  invalid: never;
}>;

function matchesLevelLevers(
  levers: ParkingJamChallengeLevers,
  level: ParkingJamLevelLevers,
): boolean {
  return (
    levers.dependency === level.dependency &&
    levers.misread === level.misread &&
    isInNumericRange(levers.scale, level.scale)
  );
}

export function assessParkingJamDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyAssessment {
  const { features } = analysis;
  const levers = calculateParkingJamChallengeLevers(features);
  if (analysis.status === "unsupported" || levers === null) {
    return { status: "unsupported" };
  }

  const initialBlockedVehicleCount =
    features.vehicleCount - features.initialLegalVehicleCount;
  if (
    features.dependencyDepth < MINIMUM_PROVIDED_DEPENDENCY_DEPTH ||
    initialBlockedVehicleCount < MINIMUM_PROVIDED_INITIAL_BLOCKED_VEHICLE_COUNT
  ) {
    return { status: "out-of-range", reason: "too-light" };
  }
  if (features.dependencyDepth > MAXIMUM_PROVIDED_DEPENDENCY_DEPTH) {
    return { status: "out-of-range", reason: "too-heavy" };
  }

  const difficulty = difficultyLevels.find(({ id }) =>
    matchesLevelLevers(levers, parkingJamLevelLevers[id]),
  )?.id;
  return difficulty
    ? { status: "classified", difficulty, levers }
    : { status: "out-of-range", reason: "unlisted-combination", levers };
}

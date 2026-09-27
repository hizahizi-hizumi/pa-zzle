/**
 * パーキングジャム難易度5段階の分類案（Issue #405 の設計調査用）。
 * 採用した案 T3 は本番の判定（`challenge-levers-v1`）そのもので、ほかの案は比較用に残す。
 * レバーの強さは本番の `calculateParkingJamChallengeLevers` の値を使う。
 */
import type { ParkingJamLeverStrength } from "@/games/parking-jam/difficulty";
import type { ParkingJamStudyFeatures } from "./parking-jam-difficulty-features";

export type StudyAssessment =
  | { status: "classified"; level: 1 | 2 | 3 | 4 | 5 }
  | { status: "too-light" }
  | { status: "too-heavy" }
  /** 提供範囲内だが、レバーの組合せがどのレベルの条件にも当たらない。 */
  | { status: "unplaced" }
  /** 状態空間を解析できず評価できない。 */
  | { status: "unsupported" };

export type StudyPlan = {
  id: string;
  summary: string;
  classify: (features: ParkingJamStudyFeatures) => StudyAssessment;
};

function level(value: 1 | 2 | 3 | 4 | 5): StudyAssessment {
  return { status: "classified", level: value };
}

/** 全車がすぐ出せる、または塞がれた車が1台だけの問題は、出す順序を読む挑戦がほぼない。 */
function isTooLight(features: ParkingJamStudyFeatures): boolean {
  return features.depth <= 1 || features.initialBlockedCount <= 1;
}

/** 深さ7以上は候補空間で0.3%未満しか現れず、代表を確かめていないため仮に範囲外とする。 */
function isTooHeavy(features: ParkingJamStudyFeatures): boolean {
  return features.depth >= 7;
}

function classifyDepthAndOverlap(
  features: ParkingJamStudyFeatures,
): StudyAssessment {
  if (isTooLight(features)) return { status: "too-light" };
  if (isTooHeavy(features)) return { status: "too-heavy" };
  if (features.depth >= 5) return level(5);
  if (features.depth === 4) return level(4);
  if (features.depth === 3) return level(3);
  if (features.maximumPrerequisiteCount >= 2) return level(2);
  return level(1);
}

function classifyOverlapPromotes(
  features: ParkingJamStudyFeatures,
): StudyAssessment {
  if (isTooLight(features)) return { status: "too-light" };
  if (isTooHeavy(features)) return { status: "too-heavy" };
  const branching = features.maximumPrerequisiteCount - (features.depth - 1);
  if (features.depth >= 5 || (features.depth === 4 && branching >= 2))
    return level(5);
  if (features.depth === 4 || (features.depth === 3 && branching >= 2))
    return level(4);
  if (features.depth === 3) return level(3);
  if (features.maximumPrerequisiteCount >= 2) return level(2);
  return level(1);
}

/**
 * 段数が深くても、ほとんどの車がすぐ出せる盤面では、先に空いた車を出すと待ちの連鎖が
 * 空いた盤面に孤立して残り、読む負荷が上がりにくいと考える（未検証の仮説）。
 */
const LONE_CHAIN_MINIMUM_LEGAL_RATIO = 0.8;

function classifyOverlapPromotesWithLoneChainGuard(
  features: ParkingJamStudyFeatures,
): StudyAssessment {
  const assessment = classifyOverlapPromotes(features);
  if (
    assessment.status === "classified" &&
    assessment.level >= 3 &&
    features.meanLegalRatio >= LONE_CHAIN_MINIMUM_LEGAL_RATIO
  )
    return level(2);
  return assessment;
}

function classifyBuried(features: ParkingJamStudyFeatures): StudyAssessment {
  if (isTooLight(features)) return { status: "too-light" };
  if (isTooHeavy(features)) return { status: "too-heavy" };
  const prerequisite = features.maximumPrerequisiteCount;
  if (prerequisite >= 6) return level(5);
  if (prerequisite >= 4) return level(4);
  if (prerequisite === 3) return level(3);
  if (prerequisite === 2) return level(2);
  return level(1);
}

function classifyScarcity(features: ParkingJamStudyFeatures): StudyAssessment {
  if (isTooLight(features)) return { status: "too-light" };
  if (isTooHeavy(features)) return { status: "too-heavy" };
  const ratio = features.meanLegalRatio;
  if (ratio < 0.5) return level(5);
  if (ratio < 0.65) return level(4);
  if (ratio < 0.75) return level(3);
  if (ratio < 0.85) return level(2);
  return level(1);
}

function classifyLocalLoadScore(
  features: ParkingJamStudyFeatures,
): StudyAssessment {
  if (isTooLight(features)) return { status: "too-light" };
  const score = features.v1Score;
  if (score >= 0.8) return level(5);
  if (score >= 0.6) return level(4);
  if (score >= 0.4) return level(3);
  if (score >= 0.2) return level(2);
  return level(1);
}

function leversOf(features: ParkingJamStudyFeatures) {
  if (!features.levers) throw new Error("Study features have no levers");
  return features.levers;
}

/** 依存レバーの強さ（本番の値）。 */
export function dependencyLeverOf(
  features: ParkingJamStudyFeatures,
): ParkingJamLeverStrength {
  return leversOf(features).dependency;
}

/** 読み違いレバーの強さ（本番の値）。 */
export function misreadLeverOf(
  features: ParkingJamStudyFeatures,
): ParkingJamLeverStrength {
  return leversOf(features).misread;
}

/** 規模レバーの強さ（本番の値）。 */
export function scaleLeverOf(
  features: ParkingJamStudyFeatures,
): ParkingJamLeverStrength {
  return leversOf(features).scale;
}

/** 本番の判定結果を調査用の分類結果へ写す。 */
function classifyByProduction(
  features: ParkingJamStudyFeatures,
): StudyAssessment {
  const { assessment } = features;
  switch (assessment.status) {
    case "classified":
      return level(Number(assessment.difficulty) as 1 | 2 | 3 | 4 | 5);
    case "out-of-range":
      return assessment.reason === "unlisted-levers"
        ? { status: "unplaced" }
        : { status: assessment.reason };
    case "unsupported":
      return { status: "unsupported" };
  }
}

type LeverStep = {
  dependency: 1 | 2 | 3;
  misread: 1 | 2 | 3;
  /** 規模レバーに許す範囲（両端を含む）。規模だけでレベルが決まらないよう、隣のレベルと範囲を重ねる。 */
  scale?: readonly [1 | 2 | 3, 1 | 2 | 3];
};

/**
 * レベル1〜5で各レバーに求める強さ。どちらのレバーも下がらないので、上位は下位の挑戦を含む。
 * `strict` は条件の組合せにちょうど当たる問題だけを採り、他の組合せは提供しない。
 * そうでなければ、両方の条件を満たす最も高いレベルにする。
 */
function classifyByLeverSteps(
  steps: readonly [LeverStep, LeverStep, LeverStep, LeverStep, LeverStep],
  strict: boolean,
) {
  return function classify(features: ParkingJamStudyFeatures): StudyAssessment {
    if (isTooLight(features)) return { status: "too-light" };
    if (isTooHeavy(features)) return { status: "too-heavy" };
    const dependency = dependencyLeverOf(features);
    const misread = misreadLeverOf(features);
    const scale = scaleLeverOf(features);
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index];
      if (!step) continue;
      const [minimumScale, maximumScale] = step.scale ?? [1, 3];
      const scaleMatches = minimumScale <= scale && scale <= maximumScale;
      const matches = strict
        ? dependency === step.dependency &&
          misread === step.misread &&
          scaleMatches
        : dependency >= step.dependency &&
          misread >= step.misread &&
          scale >= minimumScale;
      if (matches) return level((index + 1) as 1 | 2 | 3 | 4 | 5);
    }
    return { status: "unplaced" };
  };
}

const misreadFirstSteps = [
  { dependency: 1, misread: 1 },
  { dependency: 1, misread: 2 },
  { dependency: 2, misread: 2 },
  { dependency: 3, misread: 2 },
  { dependency: 3, misread: 3 },
] as const;

const dependencyFirstSteps = [
  { dependency: 1, misread: 1 },
  { dependency: 2, misread: 1 },
  { dependency: 2, misread: 2 },
  { dependency: 3, misread: 2 },
  { dependency: 3, misread: 3 },
] as const;

const alternatingSteps = [
  { dependency: 1, misread: 1 },
  { dependency: 1, misread: 2 },
  { dependency: 2, misread: 2 },
  { dependency: 2, misread: 3 },
  { dependency: 3, misread: 3 },
] as const;

const misreadFirstStepsWithScale = [
  { dependency: 1, misread: 1, scale: [1, 2] },
  { dependency: 1, misread: 2, scale: [1, 2] },
  { dependency: 2, misread: 2, scale: [1, 3] },
  { dependency: 3, misread: 2, scale: [2, 3] },
  { dependency: 3, misread: 3, scale: [2, 3] },
] as const;

const scaleStrictSteps = [
  { dependency: 1, misread: 1, scale: [1, 1] },
  { dependency: 1, misread: 2, scale: [1, 2] },
  { dependency: 2, misread: 2, scale: [2, 2] },
  { dependency: 3, misread: 2, scale: [2, 3] },
  { dependency: 3, misread: 3, scale: [3, 3] },
] as const;

export const studyPlans: readonly StudyPlan[] = [
  {
    id: "T1",
    summary:
      "依存・読み違い・規模の3レバー。依存と読み違いは M1 の階段、規模は 1〜2 / 1〜2 / 1〜3 / 2〜3 / 2〜3 の範囲に置く（隣と重ねる）",
    classify: classifyByLeverSteps(misreadFirstStepsWithScale, true),
  },
  {
    id: "T3",
    summary:
      "採用（本番 challenge-levers-v1）: 依存と読み違いは M3 の交互の階段、規模は T1 と同じ範囲",
    classify: classifyByProduction,
  },
  {
    id: "T1s",
    summary:
      "T1 の規模を狭い範囲で段ごとに上げる（1 / 1〜2 / 2 / 2〜3 / 3）。規模を強く効かせた場合の比較用",
    classify: classifyByLeverSteps(scaleStrictSteps, true),
  },
  {
    id: "M1",
    summary:
      "依存と読み違いの2レバーの階段。読み違いを先に上げる（1: 依存1・読み違い1 → 2: 1・2 → 3: 2・2 → 4: 3・2 → 5: 3・3）。組合せにちょうど当たる問題だけを採る",
    classify: classifyByLeverSteps(misreadFirstSteps, true),
  },
  {
    id: "M1c",
    summary:
      "M1 と同じ階段で、両レバーが条件以上なら最も高いレベルにする（組合せ外を下のレベルへ寄せる）",
    classify: classifyByLeverSteps(misreadFirstSteps, false),
  },
  {
    id: "M2",
    summary:
      "依存を先に上げる階段（1: 1・1 → 2: 2・1 → 3: 2・2 → 4: 3・2 → 5: 3・3）。組合せにちょうど当たる問題だけを採る",
    classify: classifyByLeverSteps(dependencyFirstSteps, true),
  },
  {
    id: "M3",
    summary:
      "交互に上げる階段（1: 1・1 → 2: 1・2 → 3: 2・2 → 4: 2・3 → 5: 3・3）。組合せにちょうど当たる問題だけを採る",
    classify: classifyByLeverSteps(alternatingSteps, true),
  },
  {
    id: "D",
    summary:
      "不採用（依存の1系統だけ）: 依存の段数を主軸にする。段数2は重なり（2台以上を先に出す車）の有無で1/2、段数3/4/5〜6を3/4/5",
    classify: classifyDepthAndOverlap,
  },
  {
    id: "D+",
    summary:
      "不採用（依存の1系統だけ）: 案Dに、段数に対して先行台数が2台以上多い（依存が枝分かれする）問題を1段上げる規則を足す",
    classify: classifyOverlapPromotes,
  },
  {
    id: "D+g",
    summary:
      "案D+で3以上になる問題のうち、平均合法車率0.8以上（待ちの連鎖が空いた盤面に孤立する）ものを2に留める",
    classify: classifyOverlapPromotesWithLoneChainGuard,
  },
  {
    id: "B",
    summary:
      "最も奥の車を出すまでの最少先行台数（1/2/3/4〜5/6以上）だけで段にする",
    classify: classifyBuried,
  },
  {
    id: "S",
    summary: "一様ランダムに出すプレイでの平均合法車率だけで段にする",
    classify: classifyScarcity,
  },
  {
    id: "V",
    summary:
      "参考: visual-local-load-v1 のスコアを0.2刻みで5つに分ける（内部値の等分の反例として見る）",
    classify: classifyLocalLoadScore,
  },
];

export function findStudyPlan(id: string): StudyPlan {
  const plan = studyPlans.find((candidate) => candidate.id === id);
  if (!plan) throw new RangeError(`Unknown plan: ${id}`);
  return plan;
}

export function formatStudyAssessment(assessment: StudyAssessment): string {
  return assessment.status === "classified"
    ? String(assessment.level)
    : assessment.status;
}

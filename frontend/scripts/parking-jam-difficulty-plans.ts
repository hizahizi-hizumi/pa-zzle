/**
 * パーキングジャム難易度5段階の分類案（Issue #405 の設計調査用）。本番の判定には使わない。
 * 各案は上から順に判定し、最初に当てはまったレベルにする。
 */
import type { ParkingJamStudyFeatures } from "./parking-jam-difficulty-features";

export type StudyAssessment =
  | { status: "classified"; level: 1 | 2 | 3 | 4 | 5 }
  | { status: "too-light" }
  | { status: "too-heavy" };

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

export const studyPlans: readonly StudyPlan[] = [
  {
    id: "D",
    summary:
      "依存の段数を主軸にする。段数2は重なり（2台以上を先に出す車）の有無で1/2、段数3/4/5〜6を3/4/5",
    classify: classifyDepthAndOverlap,
  },
  {
    id: "D+",
    summary:
      "案Dに、段数に対して先行台数が2台以上多い（依存が枝分かれする）問題を1段上げる規則を足す",
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

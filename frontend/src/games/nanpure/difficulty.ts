import type {
  DifficultyAssessment,
  DifficultyLevel,
  NoAssessmentDetail,
  RecordedDifficulty,
} from "@/games/difficulty";
import type {
  NanpureDifficultyAnalysis,
  NanpureHumanSolveFeatures,
} from "@/games/nanpure/problem/difficulty-analysis";
import type { NanpureTechnique } from "@/games/nanpure/problem/technique";

export type NanpureDifficulty = DifficultyLevel;

// 3段階（dependency-v1）時代の記録を、旧区分のまま読み込み表示するためだけに残す。
export type NanpureRecordedDifficulty = RecordedDifficulty;

export type NanpureDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: { reason: "too-light" };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

const difficultyByDeepestTechnique = {
  "full-house": "1",
  "hidden-single-block": "1",
  "hidden-single-line": "2",
  "naked-single": "2",
  "locked-candidates": "3",
  "naked-pair": "4",
  "hidden-pair": "4",
  "naked-triple": "4",
  "hidden-triple": "4",
  "x-wing": "5",
  swordfish: "5",
  "xy-wing": "5",
  "xyz-wing": "5",
} as const satisfies Record<NanpureTechnique, NanpureDifficulty>;

export function classifyNanpureChallengeDifficulty({
  deepestTechnique,
}: NanpureHumanSolveFeatures): NanpureDifficulty {
  return deepestTechnique === null
    ? "1"
    : difficultyByDeepestTechnique[deepestTechnique];
}

function isTooLight({ deepestTechnique }: NanpureHumanSolveFeatures): boolean {
  return deepestTechnique === null || deepestTechnique === "full-house";
}

export function assessNanpureDifficulty(
  analysis: NanpureDifficultyAnalysis,
): NanpureDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed":
      if (isTooLight(analysis.features)) {
        return { status: "out-of-range", reason: "too-light" };
      }
      return {
        status: "classified",
        difficulty: classifyNanpureChallengeDifficulty(analysis.features),
      };
  }
}

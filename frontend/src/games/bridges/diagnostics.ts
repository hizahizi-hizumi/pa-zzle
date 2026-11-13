import {
  assessBridgesDifficulty,
  type BridgesDifficulty,
  type BridgesDifficultyAssessment,
} from "@/games/bridges/difficulty";
import {
  analyzeBridgesDifficulty,
  BRIDGES_UNIQUENESS_NODE_LIMIT,
  type BridgesDifficultyAnalysis,
} from "@/games/bridges/problem/difficulty-analysis";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { traceBridgesHumanSolve } from "@/games/bridges/problem/generation/human-solver";
import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import {
  type BridgesProblem,
  type BridgesProblemIdentity,
  isCurrentBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import type { BridgesPooledProblem } from "@/games/bridges/problem/problem-pool";
import { restoreBridgesProblem } from "@/games/bridges/problem-selection";
import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import { isNonNegativeInteger, isRecordObject } from "@/lib/type-guards";

type BridgesUniquenessCheck = {
  solutionCount: number;
  nodeCount: number;
  exceededNodeLimit: boolean;
};

export type BridgesDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "bridges",
  BridgesDifficulty,
  BridgesProblemIdentity
> & {
  /** 回転・反転で重なる盤面に共通の正規化キー。問題集の同型除外と、素朴な解き方の乱数に使うもの。 */
  symmetryKey: string;
  uniqueness: BridgesUniquenessCheck;
  solution: readonly number[] | null;
  /** 人間向け解法器の手詰まりごとの段（`A1`〜`D`、`T`）。 */
  reasoningRounds: readonly string[];
  difficultyAnalysis: BridgesDifficultyAnalysis;
  /** 出題した難易度とは別に、今の規則で分類し直したレベル（または提供範囲外の理由）。 */
  difficultyAssessment: BridgesDifficultyAssessment;
};

function isUniquenessCheck(value: unknown): value is BridgesUniquenessCheck {
  return (
    isRecordObject(value) &&
    isNonNegativeInteger(value.solutionCount) &&
    isNonNegativeInteger(value.nodeCount) &&
    typeof value.exceededNodeLimit === "boolean"
  );
}

function isSolution(value: unknown): value is readonly number[] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every((count) => isNonNegativeInteger(count)))
  );
}

function isReasoningRounds(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((tier) => typeof tier === "string")
  );
}

const bridgesDiagnosticFormat: InternalDiagnosticFormat<BridgesDiagnosticSnapshot> =
  {
    game: "bridges",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentBridgesProblemIdentity,
    // 解・分析・分類は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails({
      symmetryKey,
      uniqueness,
      solution,
      reasoningRounds,
      difficultyAnalysis,
      difficultyAssessment,
    }) {
      return typeof symmetryKey === "string" &&
        isUniquenessCheck(uniqueness) &&
        isSolution(solution) &&
        isReasoningRounds(reasoningRounds) &&
        isRecordObject(difficultyAnalysis) &&
        typeof difficultyAnalysis.status === "string" &&
        isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string"
        ? {
            symmetryKey,
            uniqueness,
            solution,
            reasoningRounds,
            difficultyAnalysis: difficultyAnalysis as BridgesDifficultyAnalysis,
            difficultyAssessment:
              difficultyAssessment as BridgesDifficultyAssessment,
          }
        : undefined;
    },
  };

/** 解法器と素朴な解き方を走らせるので、検証情報を開いたときだけ呼ぶ。 */
export function createBridgesDiagnosticSnapshot({
  problem,
  ...input
}: {
  difficulty: BridgesDifficulty;
  problemIdentity: BridgesProblemIdentity;
  problem: BridgesProblem;
  buildRevision: string | null;
}): BridgesDiagnosticSnapshot {
  const { solutionCount, nodeCount, exceededNodeLimit, firstSolution } =
    countBridgesSolutions(problem, {
      limit: 2,
      nodeLimit: BRIDGES_UNIQUENESS_NODE_LIMIT,
    });
  const difficultyAnalysis = analyzeBridgesDifficulty(problem);
  return {
    ...createInternalDiagnosticSnapshot(bridgesDiagnosticFormat, input),
    symmetryKey: getBridgesSymmetryKey(problem),
    uniqueness: { solutionCount, nodeCount, exceededNodeLimit },
    solution:
      !exceededNodeLimit && solutionCount === 1 && firstSolution
        ? [...firstSolution]
        : null,
    reasoningRounds: traceBridgesHumanSolve(problem, "T").rounds.map(
      ({ tier }) => tier,
    ),
    difficultyAnalysis: structuredClone(difficultyAnalysis),
    difficultyAssessment: assessBridgesDifficulty(difficultyAnalysis),
  };
}

function parseBridgesDiagnosticSnapshot(
  serialized: string,
): BridgesDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, bridgesDiagnosticFormat);
}

function restoreBridgesProblemFromDiagnosticSnapshot(
  snapshot: BridgesDiagnosticSnapshot,
): BridgesPooledProblem | null {
  return restoreBridgesProblem(snapshot.problemIdentity);
}

export const _private = {
  parseBridgesDiagnosticSnapshot,
  restoreBridgesProblemFromDiagnosticSnapshot,
};

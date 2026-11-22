import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  countHakoiriMusumeProblemEmptyCells,
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  isCurrentHakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import {
  type HakoiriMusumeWorkload,
  listHakoiriMusumePoolEntries,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

type HakoiriMusumeWorkloadFeatures = HakoiriMusumeWorkload & {
  emptyCellCount: number;
};

/**
 * - `pooled`: 問題集を作るときに分析し、`--verify` で確かめた値に、盤面から数えた空きを添える。
 * - `recorded`: 問題集に無い問題の、記録したときの作業の量に、盤面から数えた空きを添える。
 */
type HakoiriMusumeDiagnosticAnalysis =
  | {
      status: "pooled";
      features: HakoiriMusumeWorkloadFeatures & {
        daughterDetourCount: number;
        shortestPreparationLength: number;
      };
    }
  | { status: "recorded"; features: HakoiriMusumeWorkloadFeatures };

export type HakoiriMusumeDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "hakoiri-musume",
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity
> & {
  difficultyAnalysis: HakoiriMusumeDiagnosticAnalysis;
};

function isWorkloadFeatures(
  value: unknown,
): value is HakoiriMusumeWorkloadFeatures {
  return (
    isRecordObject(value) &&
    isPositiveInteger(value.optimalMoveCount) &&
    isNonNegativeInteger(value.preparationLength) &&
    isNonNegativeInteger(value.emptyCellCount)
  );
}

function isDiagnosticAnalysis(
  value: unknown,
): value is HakoiriMusumeDiagnosticAnalysis {
  if (!isRecordObject(value)) {
    return false;
  }
  const { status, features } = value;
  if (!isWorkloadFeatures(features)) {
    return false;
  }
  const pooledFeatures: Record<string, unknown> = features;
  return status === "pooled"
    ? isNonNegativeInteger(pooledFeatures.daughterDetourCount) &&
        isNonNegativeInteger(pooledFeatures.shortestPreparationLength)
    : status === "recorded";
}

const hakoiriMusumeDiagnosticFormat: InternalDiagnosticFormat<HakoiriMusumeDiagnosticSnapshot> =
  {
    game: "hakoiri-musume",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentHakoiriMusumeProblemIdentity,
    readDetails({ difficultyAnalysis }) {
      return isDiagnosticAnalysis(difficultyAnalysis)
        ? { difficultyAnalysis }
        : undefined;
    },
  };

/** 問題集にある問題は問題集の値を、無い問題は `workload`（記録したときの作業の量）を出す。 */
export function createHakoiriMusumeDiagnosticSnapshot({
  workload,
  ...input
}: {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  buildRevision: string | null;
  workload: HakoiriMusumeWorkload;
}): HakoiriMusumeDiagnosticSnapshot {
  const { problem } = restoreHakoiriMusumeProblem(input.problemIdentity);
  const emptyCellCount = countHakoiriMusumeProblemEmptyCells(problem);
  const pooled = listHakoiriMusumePoolEntries(input.difficulty).find(
    ([board]) => board === input.problemIdentity.seed,
  );
  return {
    ...createInternalDiagnosticSnapshot(hakoiriMusumeDiagnosticFormat, input),
    difficultyAnalysis: pooled
      ? {
          status: "pooled",
          features: {
            optimalMoveCount: pooled[1],
            preparationLength: pooled[2],
            daughterDetourCount: pooled[3],
            shortestPreparationLength: pooled[4],
            emptyCellCount,
          },
        }
      : { status: "recorded", features: { ...workload, emptyCellCount } },
  };
}

function parseHakoiriMusumeDiagnosticSnapshot(
  serialized: string,
): HakoiriMusumeDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    hakoiriMusumeDiagnosticFormat,
  );
}

function restoreHakoiriMusumeProblemFromDiagnosticSnapshot(
  snapshot: HakoiriMusumeDiagnosticSnapshot,
): HakoiriMusumeIdentifiedProblem {
  return restoreHakoiriMusumeProblem(snapshot.problemIdentity);
}

export const _private = {
  parseHakoiriMusumeDiagnosticSnapshot,
  restoreHakoiriMusumeProblemFromDiagnosticSnapshot,
};

import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  type ReflectionDifficulty,
  type ReflectionDifficultyAssessment,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import {
  isReflectionProblemIdentity,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import type {
  ReflectionPooledProblem,
  ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";

type ReflectionDiagnosticAssessment = Extract<
  ReflectionDifficultyAssessment,
  { status: "classified" }
>;

/**
 * 問題集の問題は、生成時に分析してそのレベルに分類されたもの（`generate:reflection-pool -- --verify` で全問を確かめる）なので、
 * 問題集のレベルと、そのレベルの推論レベルを分類として返す。
 */
function assessPooledProblem(
  poolReference: ReflectionProblemPoolReference,
): ReflectionDiagnosticAssessment {
  const difficulty = parseDifficultyLevel(
    poolReference.problemId.split("-")[0],
  );
  if (difficulty === undefined) {
    throw new Error(
      `Invalid Reflection pool problem id: ${poolReference.problemId}`,
    );
  }
  return {
    status: "classified",
    difficulty,
    reasoningLevel: reflectionLevelCombinations[difficulty].reasoningLevel,
  };
}

/**
 * - `problemPool`: 出題した問題の問題集の版と番号。
 * - `difficultyAssessment`: 問題集のレベルと、そのレベルの最高推論レベル。
 */
export type ReflectionDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "reflection",
  ReflectionDifficulty,
  ReflectionProblemIdentity
> & {
  problemPool: ReflectionProblemPoolReference;
  difficultyAssessment: ReflectionDiagnosticAssessment;
};

/** 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置と分類を持つ。 */
export function createReflectionDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  poolReference,
  buildRevision,
}: {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  poolReference: ReflectionProblemPoolReference;
  buildRevision: string | null;
}): ReflectionDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "reflection",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    problemPool: { ...poolReference },
    difficultyAssessment: assessPooledProblem(poolReference),
    buildRevision,
  };
}

function isProblemPoolReference(
  value: unknown,
): value is ReflectionProblemPoolReference {
  return (
    isRecord(value) &&
    typeof value.poolVersion === "string" &&
    typeof value.problemId === "string"
  );
}

function isDifficultyAssessment(
  value: unknown,
): value is ReflectionDiagnosticAssessment {
  return (
    isRecord(value) &&
    value.status === "classified" &&
    typeof value.difficulty === "string" &&
    parseDifficultyLevel(value.difficulty) !== undefined &&
    typeof value.reasoningLevel === "number"
  );
}

export function parseReflectionDiagnosticSnapshot(
  serialized: string,
): ReflectionDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Reflection diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseDifficultyLevel(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "reflection" ||
    !difficulty ||
    !isReflectionProblemIdentity(value.problemIdentity) ||
    !isProblemPoolReference(value.problemPool) ||
    !isDifficultyAssessment(value.difficultyAssessment) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid Reflection diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "reflection",
    difficulty,
    problemIdentity: value.problemIdentity,
    problemPool: value.problemPool,
    difficultyAssessment: value.difficultyAssessment,
    buildRevision: value.buildRevision,
  };
}

/**
 * 問題集に無い identity は `null` を返す。
 */
export function restoreReflectionProblemFromDiagnosticSnapshot(
  snapshot: ReflectionDiagnosticSnapshot,
): ReflectionPooledProblem | null {
  return restoreReflectionProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

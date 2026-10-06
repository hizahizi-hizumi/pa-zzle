import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
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
import { isRecordObject } from "@/lib/type-guards";

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

function isProblemPoolReference(
  value: unknown,
): value is ReflectionProblemPoolReference {
  return (
    isRecordObject(value) &&
    typeof value.poolVersion === "string" &&
    typeof value.problemId === "string"
  );
}

function isDifficultyAssessment(
  value: unknown,
): value is ReflectionDiagnosticAssessment {
  return (
    isRecordObject(value) &&
    value.status === "classified" &&
    typeof value.difficulty === "string" &&
    parseDifficultyLevel(value.difficulty) !== undefined &&
    typeof value.reasoningLevel === "number"
  );
}

const reflectionDiagnosticFormat: InternalDiagnosticFormat<ReflectionDiagnosticSnapshot> =
  {
    game: "reflection",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isReflectionProblemIdentity,
    readDetails({ problemPool, difficultyAssessment }) {
      return isProblemPoolReference(problemPool) &&
        isDifficultyAssessment(difficultyAssessment)
        ? { problemPool, difficultyAssessment }
        : undefined;
    },
  };

/** 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置と分類を持つ。 */
export function createReflectionDiagnosticSnapshot({
  poolReference,
  ...input
}: {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  poolReference: ReflectionProblemPoolReference;
  buildRevision: string | null;
}): ReflectionDiagnosticSnapshot {
  return {
    ...createInternalDiagnosticSnapshot(reflectionDiagnosticFormat, input),
    problemPool: { ...poolReference },
    difficultyAssessment: assessPooledProblem(poolReference),
  };
}

function parseReflectionDiagnosticSnapshot(
  serialized: string,
): ReflectionDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    reflectionDiagnosticFormat,
  );
}

/** 問題集に無い identity は `null` を返す。 */
function restoreReflectionProblemFromDiagnosticSnapshot(
  snapshot: ReflectionDiagnosticSnapshot,
): ReflectionPooledProblem | null {
  return restoreReflectionProblem(snapshot.problemIdentity);
}

export const _private = {
  parseReflectionDiagnosticSnapshot,
  restoreReflectionProblemFromDiagnosticSnapshot,
};

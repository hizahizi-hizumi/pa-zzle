import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  assessReflectionDifficulty,
  parseReflectionDifficulty,
  type ReflectionDifficulty,
  type ReflectionDifficultyAssessment,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import { analyzeReflectionDifficulty } from "@/games/reflection/problem/difficulty-analysis";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  isReflectionProblemIdentity,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  findReflectionPooledProblem,
  type ReflectionPooledProblem,
  type ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import { restoreReflectionProblem } from "@/games/reflection/problem-selection";

/**
 * 問題集に無い問題を検証情報で分析し直すのは、この大きさの盤面まで。8×8 以上は分析に1分を超える問題もあり、
 * 検証情報を開くたびに画面が止まるため分析しない（`not-analyzed`）。
 */
const analyzedBoardSizeMaximum = 7;

export type ReflectionDiagnosticAssessment =
  | ReflectionDifficultyAssessment
  | { status: "not-analyzed"; reason: "large-board" };

/**
 * 問題集の問題は、生成時に分析してそのレベルに分類されたもの（`generate:reflection-pool -- --verify` で全問を確かめる）なので、
 * 問題集のレベルと、そのレベルの推論レベルを分類として返す。
 */
function assessPooledProblem(
  pooled: ReflectionPooledProblem,
): ReflectionDifficultyAssessment {
  const difficulty = pooled.poolReference.problemId.split("-")[0];
  const parsed = parseReflectionDifficulty(difficulty);
  if (parsed === undefined) {
    throw new Error(
      `Invalid Reflection pool problem id: ${pooled.poolReference.problemId}`,
    );
  }
  return {
    status: "classified",
    difficulty: parsed,
    reasoningLevel: reflectionLevelCombinations[parsed].reasoningLevel,
  };
}

/**
 * - `problemPool`: 問題集の版と番号。問題集に無い identity では `null`。
 * - `difficultyAssessment`: 分類と最高推論レベル。問題集の問題は問題集のレベル、問題集に無い問題は分析し直した結果。
 *   問題集に無い 8×8 以上の盤面は分析せず `not-analyzed` にする。
 */
export type ReflectionDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "reflection",
  ReflectionDifficulty,
  ReflectionProblemIdentity
> & {
  problemPool: ReflectionProblemPoolReference | null;
  difficultyAssessment: ReflectionDiagnosticAssessment;
};

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置と分類を持つ。
 * 問題集に無い問題は分析し直すので、プレイ中には呼ばず検証情報を開いたときだけ呼ぶ。
 */
export function createReflectionDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  buildRevision: string | null;
}): ReflectionDiagnosticSnapshot {
  const pooled = findReflectionPooledProblem(problemIdentity);
  const difficultyAssessment: ReflectionDiagnosticAssessment = pooled
    ? assessPooledProblem(pooled)
    : problemIdentity.conditions.size > analyzedBoardSizeMaximum
      ? { status: "not-analyzed", reason: "large-board" }
      : assessReflectionDifficulty(
          analyzeReflectionDifficulty(
            generateReflectionProblem(problemIdentity).problem,
          ),
        );

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "reflection",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    problemPool: pooled ? { ...pooled.poolReference } : null,
    difficultyAssessment,
    buildRevision,
  };
}

const assessmentStatuses = new Set<unknown>([
  "classified",
  "out-of-range",
  "unsupported",
  "invalid",
  "not-analyzed",
]);

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
  return isRecord(value) && assessmentStatuses.has(value.status);
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
      ? parseReflectionDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "reflection" ||
    !difficulty ||
    !isReflectionProblemIdentity(value.problemIdentity) ||
    !(
      value.problemPool === null || isProblemPoolReference(value.problemPool)
    ) ||
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

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
  REFLECTION_GENERATOR_VERSION,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  findReflectionPooledProblem,
  getReflectionProblemPoolVersion,
  type ReflectionPooledProblem,
  type ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import {
  restoreReflectionPoolProblem,
  restoreReflectionProblem,
} from "@/games/reflection/problem-selection";

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。2通りの指定を受け付ける。
// - 問題集の番号: ?pool=1&problem=4-17（`pool` は省略でき、省略時は今の問題集の版）
// - 生成器の identity: ?generator=2&seed=rf-7-10-3&size=7&pieces=10（`generator` は省略でき、省略時は今の生成器の版）
// 問題集の番号は問題集を作り直すと別の問題を指すので、記録や資料に残すときは identity の形を使う。
// identity の形では、問題集に無い問題も開ける（スコアは出さず、記録もしない）。
const identityQueryKeys = ["generator", "seed", "size", "pieces"] as const;
// `problem` は通常のプレイ画面でも問題 ID（`?problem=0123456789`）に使うので、問題集の番号の形のときだけ問題集の番号とみなす。
const poolProblemIdPattern = /^\d+-\d+$/;

function hasPoolQuery(params: URLSearchParams): boolean {
  return (
    params.has("pool") || poolProblemIdPattern.test(params.get("problem") ?? "")
  );
}

function hasIdentityQuery(params: URLSearchParams): boolean {
  return identityQueryKeys.some((key) => params.has(key));
}

export function hasReflectionProblemQuery(params: URLSearchParams): boolean {
  return hasPoolQuery(params) || hasIdentityQuery(params);
}

export function formatReflectionProblemQuery(
  identity: ReflectionProblemIdentity,
): string {
  return new URLSearchParams({
    generator: identity.generatorVersion,
    seed: identity.seed,
    size: String(identity.conditions.size),
    pieces: String(identity.conditions.pieceCount),
  }).toString();
}

export function formatReflectionPoolProblemQuery({
  poolVersion,
  problemId,
}: ReflectionProblemPoolReference): string {
  return new URLSearchParams({
    pool: poolVersion,
    problem: problemId,
  }).toString();
}

function parseInteger(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

function parsePoolProblemQuery(
  params: URLSearchParams,
): ReflectionProblemIdentity | null {
  const problemId = params.get("problem");
  if (problemId === null) return null;

  return (
    restoreReflectionPoolProblem({
      poolVersion: params.get("pool") ?? getReflectionProblemPoolVersion(),
      problemId,
    })?.identity ?? null
  );
}

function parseIdentityQuery(
  params: URLSearchParams,
): ReflectionProblemIdentity | null {
  const identity = {
    generatorVersion: params.get("generator") ?? REFLECTION_GENERATOR_VERSION,
    seed: params.get("seed"),
    conditions: {
      size: parseInteger(params.get("size")),
      pieceCount: parseInteger(params.get("pieces")),
    },
  };
  if (!isReflectionProblemIdentity(identity)) return null;

  try {
    generateReflectionProblem(identity);
  } catch {
    return null;
  }
  return identity;
}

/**
 * URL クエリから問題 identity を読み、その問題を出せることまで確かめる。
 * 問題集の番号で指定したときは、その問題の identity を返す。
 * 値が欠けている・今の問題集や生成器で扱えない・生成器が問題を作れない場合は null を返す。
 */
export function parseReflectionProblemQuery(
  params: URLSearchParams,
): ReflectionProblemIdentity | null {
  const isPoolQuery = hasPoolQuery(params);
  if (isPoolQuery === hasIdentityQuery(params)) return null;

  return isPoolQuery
    ? parsePoolProblemQuery(params)
    : parseIdentityQuery(params);
}

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
 * - `problemPool`: 問題集の版と番号。問題集に無い identity（URL で指定した問題）では `null`。
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
 * 問題集に無い問題（URL で identity を指定した問題）は、同じ identity を URL クエリで指定すれば生成器で開ける。
 */
export function restoreReflectionProblemFromDiagnosticSnapshot(
  snapshot: ReflectionDiagnosticSnapshot,
): ReflectionPooledProblem | null {
  return restoreReflectionProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

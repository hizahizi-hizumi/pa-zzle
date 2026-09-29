import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  isReflectionProblemIdentity,
  REFLECTION_GENERATOR_VERSION,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  getReflectionProblemPoolVersion,
  type ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import { restoreReflectionPoolProblem } from "@/games/reflection/problem-selection";

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。2通りの指定を受け付ける。
// - 問題集の番号: ?pool=1&problem=4-17（`pool` は省略でき、省略時は今の問題集の版）
// - 生成器の identity: ?generator=2&seed=rf-7-10-3&size=7&pieces=10（`generator` は省略でき、省略時は今の生成器の版）
// 問題集の番号は問題集を作り直すと別の問題を指すので、記録や資料に残すときは identity の形を使う。
const poolQueryKeys = ["pool", "problem"] as const;
const identityQueryKeys = ["generator", "seed", "size", "pieces"] as const;

export function hasReflectionProblemQuery(params: URLSearchParams): boolean {
  return [...poolQueryKeys, ...identityQueryKeys].some((key) =>
    params.has(key),
  );
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
  const hasPoolQuery = poolQueryKeys.some((key) => params.has(key));
  const hasIdentityQuery = identityQueryKeys.some((key) => params.has(key));
  if (hasPoolQuery === hasIdentityQuery) return null;

  return hasPoolQuery
    ? parsePoolProblemQuery(params)
    : parseIdentityQuery(params);
}

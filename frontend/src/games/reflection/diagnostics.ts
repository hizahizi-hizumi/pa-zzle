import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  isReflectionProblemIdentity,
  REFLECTION_GENERATOR_VERSION,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。
// 例: ?generator=1&seed=rf-7-10-3&size=7&pieces=10
// `generator` は省略でき、省略時は今の生成器の版とみなす。
const problemQueryKeys = ["generator", "seed", "size", "pieces"] as const;

export function hasReflectionProblemQuery(params: URLSearchParams): boolean {
  return problemQueryKeys.some((key) => params.has(key));
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

function parseInteger(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * URL クエリから問題 identity を読み、その問題を生成できることまで確かめる。
 * 値が欠けている・今の生成器で扱えない・生成器が問題を作れない場合は null を返す。
 */
export function parseReflectionProblemQuery(
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

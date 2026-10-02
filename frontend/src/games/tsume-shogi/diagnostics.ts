import { generateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generator";
import {
  isTsumeShogiProblemIdentity,
  TSUME_SHOGI_GENERATOR_VERSION,
  type TsumeShogiIdentifiedProblem,
  type TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import { restoreTsumeShogiProblem } from "@/games/tsume-shogi/problem-selection";

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。
// 例: ?generator=1&seed=ts-5-3&plies=5
// `generator` は省略でき、省略時は今の生成器の版とみなす。
const problemQueryKeys = ["generator", "seed", "plies"] as const;

export function hasTsumeShogiProblemQuery(params: URLSearchParams): boolean {
  return problemQueryKeys.some((key) => params.has(key));
}

export function formatTsumeShogiProblemQuery(
  identity: TsumeShogiProblemIdentity,
): string {
  return new URLSearchParams({
    generator: identity.generatorVersion,
    seed: identity.seed,
    plies: String(identity.conditions.plies),
  }).toString();
}

function parseInteger(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * URL クエリの identity から問題を復元する。出題できる問題に無い identity は生成器で作る
 * （5手詰では数秒から1分近くかかることがある。内部診断でだけ使う）。
 * 値が欠けている・今の生成器で扱えない・生成器が問題を作れない場合は null を返す。
 */
export function parseTsumeShogiProblemQuery(
  params: URLSearchParams,
): TsumeShogiIdentifiedProblem | null {
  const identity = {
    generatorVersion: params.get("generator") ?? TSUME_SHOGI_GENERATOR_VERSION,
    seed: params.get("seed"),
    conditions: { plies: parseInteger(params.get("plies")) },
  };
  if (!isTsumeShogiProblemIdentity(identity)) return null;

  const restored = restoreTsumeShogiProblem(identity);
  if (restored) return restored;

  try {
    const { problem } = generateTsumeShogiProblem(identity);
    return { problem, identity };
  } catch {
    return null;
  }
}

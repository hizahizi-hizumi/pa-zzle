import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  assessTsumeShogiDifficulty,
  type TsumeShogiDifficulty,
  type TsumeShogiDifficultyAssessment,
} from "@/games/tsume-shogi/difficulty";
import {
  analyzeTsumeShogiDifficulty,
  type TsumeShogiDifficultyFeatures,
} from "@/games/tsume-shogi/problem/difficulty-analysis";
import { generateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generator";
import {
  formatTsumeShogiProblemText,
  isTsumeShogiProblemIdentity,
  TSUME_SHOGI_GENERATOR_VERSION,
  type TsumeShogiIdentifiedProblem,
  type TsumeShogiProblem,
  type TsumeShogiProblemIdentity,
  type TsumeShogiProblemText,
  type TsumeShogiRootCheckRange,
} from "@/games/tsume-shogi/problem/problem";
import {
  findTsumeShogiPooledProblem,
  getTsumeShogiProblemPoolVersion,
  type TsumeShogiProblemPoolReference,
} from "@/games/tsume-shogi/problem/problem-pool";
import {
  restoreTsumeShogiPoolProblem,
  restoreTsumeShogiProblem,
} from "@/games/tsume-shogi/problem-selection";

// 内部診断が有効なビルドで、特定の問題を遊ぶための URL クエリ。2通りの指定を受け付ける。
// - 問題集の番号: ?pool=1&problem=4-17（`pool` は省略でき、省略時は今の問題集の版）
// - 生成器の identity: ?generator=1&seed=ts-5-c1-4-3&plies=5&checks=1-4（`generator` は省略でき、省略時は今の生成器の版。
//   `checks` は生成条件の初手の王手の数の範囲で、無い identity では省く）
// 問題集の番号は問題集を作り直すと別の問題を指すので、記録や資料に残すときは identity の形を使う。
const poolQueryKeys = ["pool", "problem"] as const;
const identityQueryKeys = ["generator", "seed", "plies", "checks"] as const;

export function hasTsumeShogiProblemQuery(params: URLSearchParams): boolean {
  return [...poolQueryKeys, ...identityQueryKeys].some((key) =>
    params.has(key),
  );
}

export function formatTsumeShogiPoolProblemQuery({
  poolVersion,
  problemId,
}: TsumeShogiProblemPoolReference): string {
  return new URLSearchParams({
    pool: poolVersion,
    problem: problemId,
  }).toString();
}

export function formatTsumeShogiProblemQuery(
  identity: TsumeShogiProblemIdentity,
): string {
  const { plies, rootChecks } = identity.conditions;
  return new URLSearchParams({
    generator: identity.generatorVersion,
    seed: identity.seed,
    plies: String(plies),
    ...(rootChecks === undefined
      ? {}
      : { checks: `${rootChecks.minimum}-${rootChecks.maximum}` }),
  }).toString();
}

function parseInteger(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

/** `checks` の値（`<下限>-<上限>`）。無ければ `undefined`、形が違えば `null`。 */
function parseRootCheckRange(
  value: string | null,
): TsumeShogiRootCheckRange | null | undefined {
  if (value === null) return undefined;
  const match = value.match(/^(\d+)-(\d+)$/);
  return match
    ? { minimum: Number(match[1]), maximum: Number(match[2]) }
    : null;
}

function parsePoolProblemQuery(
  params: URLSearchParams,
): TsumeShogiIdentifiedProblem | null {
  const problemId = params.get("problem");
  if (problemId === null) return null;

  const pooled = restoreTsumeShogiPoolProblem({
    poolVersion: params.get("pool") ?? getTsumeShogiProblemPoolVersion(),
    problemId,
  });
  return pooled && { problem: pooled.problem, identity: pooled.identity };
}

function parseIdentityQuery(
  params: URLSearchParams,
): TsumeShogiIdentifiedProblem | null {
  const rootChecks = parseRootCheckRange(params.get("checks"));
  const identity = {
    generatorVersion: params.get("generator") ?? TSUME_SHOGI_GENERATOR_VERSION,
    seed: params.get("seed"),
    conditions: {
      plies: parseInteger(params.get("plies")),
      ...(rootChecks === undefined ? {} : { rootChecks }),
    },
  };
  if (!isTsumeShogiProblemIdentity(identity)) return null;

  const restored = restoreTsumeShogiProblem(identity);
  if (restored)
    return { problem: restored.problem, identity: restored.identity };

  try {
    const { problem } = generateTsumeShogiProblem(identity);
    return { problem, identity };
  } catch {
    return null;
  }
}

/**
 * URL クエリから問題を復元する。問題集の番号で指定したときは問題集の問題を、identity で指定したときは問題集の問題か、
 * 問題集に無ければ生成器で作った問題を返す（5手詰では数秒から1分近くかかることがある。内部診断でだけ使う）。
 * 値が欠けている・2通りの指定が混ざる・今の問題集や生成器で扱えない・生成器が問題を作れない場合は null を返す。
 */
export function parseTsumeShogiProblemQuery(
  params: URLSearchParams,
): TsumeShogiIdentifiedProblem | null {
  const hasPoolQuery = poolQueryKeys.some((key) => params.has(key));
  const hasIdentityQuery = identityQueryKeys.some((key) => params.has(key));
  if (hasPoolQuery === hasIdentityQuery) return null;

  return hasPoolQuery
    ? parsePoolProblemQuery(params)
    : parseIdentityQuery(params);
}

/**
 * - `problemPool`: 問題集の版と番号。問題集に無い identity（URL で指定した問題）では `null`。
 * - `problem`: 初期局面（SFEN）と作意（USI）。人間のレビューで盤面を確かめ、外部の将棋ソフトへ渡せるよう文字列で持つ。
 * - `difficultyFeatures`: 難易度分析の特徴（判断地点ごとの内訳と手筋の数を含む）。分析できない問題では `null`。
 * - `difficultyAssessment`: 特徴の分類。問題集の問題でも分析し直し、問題集のレベルと食い違えば分類の方を見せる。
 */
export type TsumeShogiDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "tsume-shogi",
  TsumeShogiDifficulty,
  TsumeShogiProblemIdentity
> & {
  problemPool: TsumeShogiProblemPoolReference | null;
  problem: TsumeShogiProblemText;
  difficultyFeatures: TsumeShogiDifficultyFeatures | null;
  difficultyAssessment: TsumeShogiDifficultyAssessment;
};

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と、出題した難易度・ビルド、問題集の位置、局面と作意、
 * 難易度の特徴と分類を持つ。難易度分析は5手詰で数秒かかることがあるので、プレイ中には呼ばず検証情報を開いたときだけ呼ぶ。
 */
export function createTsumeShogiDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  problem,
  buildRevision,
}: {
  difficulty: TsumeShogiDifficulty;
  problemIdentity: TsumeShogiProblemIdentity;
  problem: TsumeShogiProblem;
  buildRevision: string | null;
}): TsumeShogiDiagnosticSnapshot {
  const pooled = findTsumeShogiPooledProblem(problemIdentity);
  const analysis = analyzeTsumeShogiDifficulty(problem);
  const { conditions } = problemIdentity;

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "tsume-shogi",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: {
        ...conditions,
        ...(conditions.rootChecks === undefined
          ? {}
          : { rootChecks: { ...conditions.rootChecks } }),
      },
    },
    problemPool: pooled ? { ...pooled.poolReference } : null,
    problem: formatTsumeShogiProblemText(problem),
    difficultyFeatures:
      analysis.status === "analyzed" ? analysis.features : null,
    difficultyAssessment: assessTsumeShogiDifficulty(analysis),
    buildRevision,
  };
}

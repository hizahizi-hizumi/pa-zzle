import type {
  DecisionBatch,
  EvaluationPlan,
  RequestEstimator,
  RequestTokenBudget,
  Rule,
  RunResult,
  SemanticDecisionProvider,
  SourceRange,
} from "../domain/model.ts";
import { runEvaluationPlan } from "../engine/run.ts";
import { buildDecisionBatches } from "../planning/batches.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import { buildDecisionState } from "../units/layout.ts";
import type { UnitExtractor } from "../units/extract.ts";
import type {
  GoldenFileStatus,
  GoldenSet,
  ResolvedGoldenFile,
} from "./golden.ts";
import {
  type FindingRange,
  findingRange,
  formatRange,
  type ScoredEvaluation,
} from "./score.ts";

/** 1回の実行を方式非依存に採点するための記録。 */
export type BenchmarkRun = {
  /** 違反箇所の指摘。厳密一致の採点に使う。 */
  findings: FindingRange[];
  /** 違反と判定したunitの範囲。包含一致（unit単位）の採点に使う。 */
  unitFindings: FindingRange[];
  /** threshold sweepに使う判定記録。判定記録を持たない実行結果ではnull。 */
  evaluations: ScoredEvaluation[] | null;
  /** このruleの判定を含んだrequestの数。 */
  providerRequests: number | null;
  /**
   * このruleに按分したinput token。複数ruleを1 requestにまとめるため、
   * requestの実usageを見積もりの内訳（質問は各rule、stateと固定費は質問数）の比で配る。
   */
  inputTokens: number | null;
  outputTokens: number | null;
  /** 同じ按分でruleに配った推定input token。 */
  estimatedInputTokens?: number | null;
  durationMs: number | null;
};

export type BenchmarkRuleResult = {
  golden: GoldenSet;
  rule: Rule;
  fileStatuses: Array<{ path: string; status: GoldenFileStatus }>;
  runs: BenchmarkRun[];
};

/** 1 requestの見積もりと、providerが返した実usage。推定係数の検証に使う。 */
export type BenchmarkRequestRecord = {
  path: string;
  /** ruleごとの質問数と、その質問の推定token。 */
  questions: Record<string, number>;
  questionEstimates: Record<string, number>;
  /** JSONにしたstateの文字数と、そのうち非ASCII文字の数。 */
  stateChars: number;
  stateNonAsciiChars: number;
  estimate: { state: number; questions: number; total: number };
  /** providerの実usage。providerを呼ばない計画ではnull。 */
  inputTokens: number | null;
  outputTokens: number | null;
};

export type BenchmarkPlan = {
  plan: EvaluationPlan;
  batches: DecisionBatch[];
  requests: BenchmarkRequestRecord[];
  /** 対象fileの行数 × そのfileをgoldenに持つrule数の合計。 */
  lineRules: number;
};

export type GoldenBenchmarkResult = {
  rules: BenchmarkRuleResult[];
  plan: Omit<BenchmarkPlan, "plan" | "batches">;
  /** runごとのrequest記録。 */
  runRequests: BenchmarkRequestRecord[][];
};

type BenchmarkTarget = { golden: GoldenSet; files: ResolvedGoldenFile[] };

/**
 * golden対象ファイルを、checkと同じくfileごとに全ruleを1 requestへまとめて評価する計画を作る。
 * 各fileでは、そのfileをgoldenに持つruleだけを判定する。
 */
export function planGoldenBenchmark(options: {
  targets: BenchmarkTarget[];
  rules: Rule[];
  extractor: UnitExtractor;
  estimator: RequestEstimator;
  requestTokenBudget: RequestTokenBudget;
}): BenchmarkPlan {
  const { targets, rules, extractor, estimator, requestTokenBudget } = options;
  const targetRules = targets.map(({ golden }) => findRule(rules, golden));
  const documents = new Map<string, ResolvedGoldenFile>();
  const rulesByPath = new Map<string, Set<string>>();

  for (const { golden, files } of targets) {
    for (const file of files) {
      const existing = documents.get(file.path);

      if (existing && existing.blob !== file.blob) {
        throw new Error(
          `同じfileのgolden blobがruleにより異なります: ${file.path}`,
        );
      }

      documents.set(file.path, file);
      rulesByPath.set(
        file.path,
        (rulesByPath.get(file.path) ?? new Set()).add(golden.ruleId),
      );
    }
  }

  const planned = buildEvaluationPlan({
    documents: [...documents.values()].map((file) => ({
      path: file.path,
      source: file.source,
    })),
    rules: targetRules,
    extractor,
    matchesPath: () => true,
  });
  const plan: EvaluationPlan = {
    files: planned.files.map((file) => ({
      ...file,
      tasks: file.tasks.filter((task) =>
        rulesByPath.get(file.path)?.has(task.ruleId),
      ),
    })),
  };
  const batches = buildDecisionBatches({
    plan,
    rules: targetRules,
    estimator,
    budget: requestTokenBudget,
  });

  return {
    plan,
    batches,
    requests: batches.map((batch) => requestRecord(batch, estimator, null)),
    lineRules: plan.files.reduce(
      (sum, file) =>
        sum +
        file.source.split("\n").length *
          (rulesByPath.get(file.path)?.size ?? 0),
      0,
    ),
  };
}

/** 現行方式のrule定義とthresholdでgolden対象ファイルを繰り返し評価する。 */
export async function runGoldenBenchmark(options: {
  targets: BenchmarkTarget[];
  rules: Rule[];
  extractor: UnitExtractor;
  provider: SemanticDecisionProvider;
  repeat: number;
  concurrency: number;
  requestTokenBudget: RequestTokenBudget;
}): Promise<GoldenBenchmarkResult> {
  const { targets, rules, provider, repeat, concurrency, requestTokenBudget } =
    options;

  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error("repeatは1以上の整数で指定してください。");
  }

  const planned = planGoldenBenchmark({
    ...options,
    estimator: provider,
  });
  const targetRules = targets.map(({ golden }) => findRule(rules, golden));
  const runs: Array<{ result: RunResult; requests: BenchmarkRequestRecord[] }> =
    [];

  for (let index = 0; index < repeat; index += 1) {
    const requests: BenchmarkRequestRecord[] = [];
    const result = await runEvaluationPlan({
      plan: planned.plan,
      rules: targetRules,
      provider,
      concurrency,
      requestTokenBudget,
      // thresholdを掃引するため、threshold未満の違反判定も違反箇所まで問う。
      locateBelowThreshold: true,
      onResponse: (batch, response) => {
        requests.push(requestRecord(batch, provider, response.usage));
      },
    });
    runs.push({ result, requests });
  }

  return {
    rules: targets.map(({ golden, files }) => {
      const rule = findRule(rules, golden);

      return {
        golden,
        rule,
        fileStatuses: files.map((file) => ({
          path: file.path,
          status: file.status,
        })),
        runs: runs.map(({ result, requests }) => ({
          ...benchmarkRunFromRunResult(result, rule.id),
          ...attributeUsage(requests, rule.id),
          durationMs: result.metrics.totalDurationMs,
        })),
      };
    }),
    plan: { requests: planned.requests, lineRules: planned.lineRules },
    runRequests: runs.map(({ requests }) => requests),
  };
}

function requestRecord(
  batch: DecisionBatch,
  estimator: RequestEstimator,
  usage: { inputTokens: number; outputTokens: number } | null,
): BenchmarkRequestRecord {
  const estimate = estimator.estimate(batch);
  const stateJson = JSON.stringify(buildDecisionState(batch).state);
  const questions: Record<string, number> = {};
  const questionEstimates: Record<string, number> = {};

  for (const [index, request] of batch.requests.entries()) {
    questions[request.ruleId] = (questions[request.ruleId] ?? 0) + 1;
    questionEstimates[request.ruleId] =
      (questionEstimates[request.ruleId] ?? 0) +
      (estimate.questions[index] ?? 0);
  }

  return {
    path: batch.file.path,
    questions,
    questionEstimates,
    stateChars: stateJson.length,
    stateNonAsciiChars: [...stateJson].filter(
      (character) => (character.codePointAt(0) ?? 0) > 0x7f,
    ).length,
    estimate: {
      state: estimate.state,
      questions: estimate.questions.reduce((sum, value) => sum + value, 0),
      total: estimate.total,
    },
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
  };
}

/**
 * requestの見積もりのうちruleに帰属する割合。質問の見積もりはそのrule、
 * stateとrequest固定費は質問数の比で配る。
 */
export function ruleShare(
  record: BenchmarkRequestRecord,
  ruleId: string,
): number {
  const own = record.questions[ruleId] ?? 0;

  if (own === 0) {
    return 0;
  }

  const count = Object.values(record.questions).reduce(
    (sum, value) => sum + value,
    0,
  );
  const shared = record.estimate.total - record.estimate.questions;
  const ownEstimate =
    (record.questionEstimates[ruleId] ?? 0) + (shared * own) / count;

  return record.estimate.total === 0
    ? own / count
    : ownEstimate / record.estimate.total;
}

function attributeUsage(
  records: readonly BenchmarkRequestRecord[],
  ruleId: string,
): Pick<
  BenchmarkRun,
  "providerRequests" | "inputTokens" | "outputTokens" | "estimatedInputTokens"
> {
  let requests = 0;
  let input = 0;
  let output = 0;
  let estimated = 0;

  for (const record of records) {
    const share = ruleShare(record, ruleId);

    if (share === 0) {
      continue;
    }

    requests += 1;
    input += (record.inputTokens ?? 0) * share;
    output += (record.outputTokens ?? 0) * share;
    estimated += record.estimate.total * share;
  }

  return {
    providerRequests: requests,
    inputTokens: Math.round(input),
    outputTokens: Math.round(output),
    estimatedInputTokens: Math.round(estimated),
  };
}

/**
 * `check --format json` などのRunResultから1ruleぶんの記録を取り出す。
 * usageはrule単位に分けられないため、他ruleの判定を含む場合はnullにする。
 */
export function benchmarkRunFromRunResult(
  result: RunResult,
  ruleId: string,
): BenchmarkRun {
  const ownEvaluations = result.evaluations.filter(
    (evaluation) => evaluation.ruleId === ruleId,
  );
  const singleRule =
    ownEvaluations.length > 0 &&
    ownEvaluations.length === result.evaluations.length;

  const ownDiagnostics = result.diagnostics.filter(
    (diagnostic) => diagnostic.ruleId === ruleId,
  );
  // 指摘位置を宣言したunitの指摘は、同じ行の別の名前と区別するため列まで採点する。
  const reportedSubjects = new Set(
    ownEvaluations
      .filter((evaluation) => evaluation.subject.reportRange !== undefined)
      .map((evaluation) =>
        formatRange(findingRange(evaluation.subject.path, evaluation.subject.range)),
      ),
  );
  const scoredRange = (path: string, subject: SourceRange, range: SourceRange) =>
    reportedSubjects.has(formatRange(findingRange(path, subject)))
      ? findingRange(path, range)
      : { path, startLine: range.startLine, endLine: range.endLine };
  const units = new Map(
    ownDiagnostics.map((diagnostic) => {
      const range = scoredRange(
        diagnostic.path,
        diagnostic.subjectRange,
        diagnostic.subjectRange,
      );

      return [formatRange(range), range];
    }),
  );

  return {
    findings: ownDiagnostics.map((diagnostic) =>
      scoredRange(diagnostic.path, diagnostic.subjectRange, diagnostic.range),
    ),
    unitFindings: [...units.values()],
    evaluations:
      ownEvaluations.length === 0
        ? null
        : ownEvaluations.map((evaluation) => ({
            path: evaluation.subject.path,
            range:
              evaluation.subject.reportRange === undefined
                ? {
                    startLine: evaluation.subject.range.startLine,
                    endLine: evaluation.subject.range.endLine,
                  }
                : evaluation.subject.range,
            ...(evaluation.subject.reportRange === undefined
              ? {}
              : { report: evaluation.subject.reportRange }),
            decision: evaluation.result.decision,
            violationProbability: evaluation.result.probabilities.violation,
            ...(evaluation.parts === undefined
              ? {}
              : {
                  parts: evaluation.parts.map((part) => ({
                    kind: part.kind,
                    range: {
                      startLine: part.range.startLine,
                      endLine: part.range.endLine,
                    },
                    probability: part.probability,
                  })),
                }),
          })),
    providerRequests: singleRule ? result.metrics.providerRequests : null,
    inputTokens: singleRule ? result.metrics.inputTokens : null,
    outputTokens: singleRule ? result.metrics.outputTokens : null,
    durationMs: singleRule ? result.metrics.totalDurationMs : null,
  };
}

export function findRule(rules: Rule[], golden: GoldenSet): Rule {
  const rule = rules.find((candidate) => candidate.id === golden.ruleId);

  if (!rule) {
    throw new Error(
      `goldenが未知のruleを参照しています: ${golden.ruleId} (${golden.origin})`,
    );
  }

  return rule;
}

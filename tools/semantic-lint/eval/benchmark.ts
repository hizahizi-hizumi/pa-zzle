import type {
  RequestTokenBudget,
  Rule,
  RunResult,
  SemanticDecisionProvider,
} from "../domain/model.ts";
import { runEvaluationPlan } from "../engine/run.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import type { UnitExtractor } from "../units/extract.ts";
import type {
  GoldenFileStatus,
  GoldenSet,
  ResolvedGoldenFile,
} from "./golden.ts";
import type { FindingRange, ScoredEvaluation } from "./score.ts";

/** 1回の実行を方式非依存に採点するための記録。 */
export type BenchmarkRun = {
  findings: FindingRange[];
  /** threshold sweepに使う判定記録。判定記録を持たない実行結果ではnull。 */
  evaluations: ScoredEvaluation[] | null;
  providerRequests: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
};

export type BenchmarkRuleResult = {
  golden: GoldenSet;
  rule: Rule;
  fileStatuses: Array<{ path: string; status: GoldenFileStatus }>;
  runs: BenchmarkRun[];
};

/** 現行方式のrule定義とthresholdでgolden対象ファイルを繰り返し評価する。 */
export async function runGoldenBenchmark(options: {
  targets: Array<{ golden: GoldenSet; files: ResolvedGoldenFile[] }>;
  rules: Rule[];
  extractor: UnitExtractor;
  provider: SemanticDecisionProvider;
  repeat: number;
  concurrency: number;
  requestTokenBudget: RequestTokenBudget;
}): Promise<BenchmarkRuleResult[]> {
  const {
    targets,
    rules,
    extractor,
    provider,
    repeat,
    concurrency,
    requestTokenBudget,
  } = options;

  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error("repeatは1以上の整数で指定してください。");
  }

  const results: BenchmarkRuleResult[] = [];

  for (const { golden, files } of targets) {
    const rule = findRule(rules, golden);
    const plan = buildEvaluationPlan({
      documents: files.map((file) => ({ path: file.path, source: file.source })),
      rules: [rule],
      extractor,
      matchesPath: () => true,
      statuses: [rule.status],
    });
    const runs: BenchmarkRun[] = [];

    for (let index = 0; index < repeat; index += 1) {
      const result = await runEvaluationPlan({
        plan,
        rules: [rule],
        provider,
        concurrency,
        requestTokenBudget,
      });
      runs.push(benchmarkRunFromRunResult(result, rule.id));
    }

    results.push({
      golden,
      rule,
      fileStatuses: files.map((file) => ({
        path: file.path,
        status: file.status,
      })),
      runs,
    });
  }

  return results;
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

  return {
    findings: result.diagnostics
      .filter((diagnostic) => diagnostic.ruleId === ruleId)
      .map((diagnostic) => ({
        path: diagnostic.path,
        startLine: diagnostic.range.startLine,
        endLine: diagnostic.range.endLine,
      })),
    evaluations:
      ownEvaluations.length === 0
        ? null
        : ownEvaluations.map((evaluation) => ({
            path: evaluation.subject.path,
            range: {
              startLine: evaluation.subject.range.startLine,
              endLine: evaluation.subject.range.endLine,
            },
            decision: evaluation.result.decision,
            violationProbability: evaluation.result.probabilities.violation,
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

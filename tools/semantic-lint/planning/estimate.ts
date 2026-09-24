import type {
  EvaluationPlan,
  RequestEstimator,
  Rule,
} from "../domain/model.ts";
import type { PlannedRequests } from "../engine/run.ts";
import type { PathMatcher } from "./planner.ts";

/** providerを呼ばずに見積もったrequest計画の大きさ。 */
export type RequestPlanSummary = {
  files: number;
  units: number;
  plannedDecisions: number;
  cacheHits: number;
  requests: number;
  decisionsSent: number;
  estimatedInputTokens: {
    total: number;
    state: number;
    questions: number;
    requestBase: number;
  };
  /** 対象fileの行数 × そのfileに適用するrule数の合計。 */
  lineRules: number;
  estimatedInputTokensPerLineRule: number | null;
  largestRequest: number;
};

export function summarizeRequestPlan(options: {
  plan: EvaluationPlan;
  planned: PlannedRequests;
  estimator: RequestEstimator;
  rules: Rule[];
  matchesPath: PathMatcher;
}): RequestPlanSummary {
  const { plan, planned, estimator, rules, matchesPath } = options;
  const estimates = planned.batches.map((batch) => estimator.estimate(batch));
  const state = sum(estimates.map((estimate) => estimate.state));
  const questions = sum(estimates.map((estimate) => sum(estimate.questions)));
  const total = sum(estimates.map((estimate) => estimate.total));
  const lineRules = sum(
    plan.files.map(
      (file) =>
        countLines(file.source) *
        rules.filter((rule) => matchesPath(rule.paths, file.path)).length,
    ),
  );

  return {
    files: plan.files.length,
    units: sum(plan.files.map((file) => file.units.length)),
    plannedDecisions: sum(plan.files.map((file) => file.tasks.length)),
    cacheHits: planned.cachedEvaluations.size,
    requests: planned.batches.length,
    decisionsSent: sum(planned.batches.map((batch) => batch.requests.length)),
    estimatedInputTokens: {
      total,
      state,
      questions,
      requestBase: total - state - questions,
    },
    lineRules,
    estimatedInputTokensPerLineRule: lineRules === 0 ? null : total / lineRules,
    largestRequest: Math.max(0, ...estimates.map((estimate) => estimate.total)),
  };
}

export function renderRequestPlanSummary(summary: RequestPlanSummary): string {
  const tokens = summary.estimatedInputTokens;
  const perLineRule = summary.estimatedInputTokensPerLineRule;

  return [
    "request plan (providerは呼んでいません。tokenはJev課金係数による推定)",
    `files: ${summary.files}`,
    `units: ${summary.units}`,
    `decisions: ${summary.plannedDecisions} (cache hit ${summary.cacheHits}, 送信 ${summary.decisionsSent})`,
    `requests: ${summary.requests} (最大 ${summary.largestRequest} tokens)`,
    `estimated input tokens: ${tokens.total} (state ${tokens.state}, questions ${tokens.questions}, request固定 ${tokens.requestBase})`,
    `per line × rule: ${perLineRule === null ? "-" : perLineRule.toFixed(2)} (${summary.lineRules} line-rules)`,
    "違反箇所の特定（2段目）は1段目で違反と判定したunitだけを問うため、この見積もりに含めない。",
    "",
  ].join("\n");
}

function countLines(source: string): number {
  return source.split("\n").length;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

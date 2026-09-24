import type {
  Rule,
  RuleStatus,
  RunMetrics,
  RunResult,
  SemanticDecisionProvider,
  SourceDocument,
} from "../domain/model.ts";
import { buildEvaluationPlan, type PathMatcher } from "../planning/planner.ts";
import type { ChoiceProvider } from "../providers/choice.ts";
import type { ScopeRegistry } from "../scopes/registry.ts";
import type { DecisionCache } from "../units/cache.ts";
import {
  buildUnitPlan,
  isUnitRule,
  runUnitPlan,
  type UnitEngineOptions,
} from "../units/engine.ts";
import type { UnitRegistry } from "../units/registry.ts";
import { runEvaluationPlan } from "./run.ts";

/** scope方式とunit方式のruleをそれぞれのengineで実行し、1つのRunResultにまとめる。 */
export async function runRules(options: {
  documents: readonly SourceDocument[];
  rules: readonly Rule[];
  statuses: readonly RuleStatus[];
  matchesPath: PathMatcher;
  scopes: ScopeRegistry;
  units: UnitRegistry;
  decisionProvider: () => SemanticDecisionProvider;
  choiceProvider: () => ChoiceProvider;
  concurrency: number;
  maxDecisionsPerRequest: number;
  cache?: DecisionCache;
  unitEngine?: Partial<UnitEngineOptions>;
}): Promise<RunResult> {
  const allowed = new Set(options.statuses);
  const selected = options.rules.filter((rule) => allowed.has(rule.status));
  const scopeRules = selected.filter((rule) => !isUnitRule(rule));
  const unitRules = selected.filter(isUnitRule);
  const results: RunResult[] = [];

  if (scopeRules.length > 0) {
    const plan = buildEvaluationPlan({
      documents: [...options.documents],
      rules: scopeRules,
      scopes: options.scopes,
      matchesPath: options.matchesPath,
      statuses: options.statuses,
    });

    if (plan.files.some((file) => file.tasks.length > 0)) {
      results.push(
        await runEvaluationPlan({
          plan,
          rules: scopeRules,
          provider: options.decisionProvider(),
          concurrency: options.concurrency,
          maxDecisionsPerRequest: options.maxDecisionsPerRequest,
        }),
      );
    }
  }

  if (unitRules.length > 0) {
    const plan = buildUnitPlan({
      documents: options.documents,
      rules: unitRules,
      units: options.units,
      matchesPath: options.matchesPath,
      statuses: options.statuses,
      ...(options.unitEngine?.unitOptions === undefined
        ? {}
        : { unitOptions: options.unitEngine.unitOptions }),
    });

    if (plan.files.some((file) => file.tasks.length > 0)) {
      results.push(
        await runUnitPlan({
          plan,
          units: options.units,
          provider: options.choiceProvider(),
          ...(options.cache === undefined ? {} : { cache: options.cache }),
          engine: {
            concurrency: options.concurrency,
            maxQuestionsPerRequest: options.maxDecisionsPerRequest,
            ...options.unitEngine,
          },
        }),
      );
    }
  }

  return mergeRunResults(results);
}

export function mergeRunResults(results: readonly RunResult[]): RunResult {
  const diagnostics = results
    .flatMap((result) => result.diagnostics)
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.range.startLine - right.range.startLine ||
        left.ruleId.localeCompare(right.ruleId),
    );

  return {
    schemaVersion: 1,
    diagnostics,
    unknowns: results.flatMap((result) => result.unknowns),
    evaluations: results.flatMap((result) => result.evaluations),
    metrics: mergeMetrics(results.map((result) => result.metrics), diagnostics.length),
  };
}

function mergeMetrics(metrics: readonly RunMetrics[], diagnostics: number): RunMetrics {
  const sum = (pick: (metric: RunMetrics) => number | undefined): number =>
    metrics.reduce((total, metric) => total + (pick(metric) ?? 0), 0);

  return {
    scannedFiles: Math.max(0, ...metrics.map((metric) => metric.scannedFiles)),
    subjects: sum((metric) => metric.subjects),
    plannedEvaluations: sum((metric) => metric.plannedEvaluations),
    providerRequests: sum((metric) => metric.providerRequests),
    providerDecisions: sum((metric) => metric.providerDecisions),
    diagnostics,
    unknowns: sum((metric) => metric.unknowns),
    inputTokens: sum((metric) => metric.inputTokens),
    outputTokens: sum((metric) => metric.outputTokens),
    totalDurationMs: sum((metric) => metric.totalDurationMs),
    providerLatencyMs: metrics.flatMap((metric) => metric.providerLatencyMs),
    ...(metrics.some((metric) => metric.judgeRequests !== undefined)
      ? {
          judgeRequests: sum((metric) => metric.judgeRequests),
          locateRequests: sum((metric) => metric.locateRequests),
          cacheHits: sum((metric) => metric.cacheHits),
        }
      : {}),
  };
}

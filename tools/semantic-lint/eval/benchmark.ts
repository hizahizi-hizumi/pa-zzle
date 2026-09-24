import type {
  Rule,
  RunResult,
  SemanticDecisionProvider,
} from "../domain/model.ts";
import { runEvaluationPlan } from "../engine/run.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import type { ChoiceProvider } from "../providers/choice.ts";
import type { ScopeRegistry } from "../scopes/registry.ts";
import {
  buildUnitPlan,
  isUnitRule,
  runUnitPlan,
  type UnitEngineOptions,
} from "../units/engine.ts";
import type { UnitRegistry } from "../units/registry.ts";
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
  /** unit方式の判定requestと位置特定requestの内訳。 */
  judgeRequests?: number | null;
  locateRequests?: number | null;
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

/**
 * rule定義とthresholdでgolden対象ファイルを繰り返し評価する。
 * unit ruleはthreshold sweepのため、threshold未満のviolationも位置特定する。
 */
export async function runGoldenBenchmark(options: {
  targets: Array<{ golden: GoldenSet; files: ResolvedGoldenFile[] }>;
  rules: Rule[];
  scopes: ScopeRegistry;
  provider: SemanticDecisionProvider;
  units?: UnitRegistry;
  choiceProvider?: ChoiceProvider;
  unitEngine?: Partial<UnitEngineOptions>;
  /** goldenのrule id `<ruleset>/<id>` を `<rulesFrom>/<id>` のruleで評価する。 */
  rulesFrom?: string;
  repeat: number;
  concurrency: number;
  maxDecisionsPerRequest: number;
}): Promise<BenchmarkRuleResult[]> {
  const {
    targets,
    rules,
    scopes,
    provider,
    repeat,
    concurrency,
    maxDecisionsPerRequest,
  } = options;

  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error("repeatは1以上の整数で指定してください。");
  }

  const results: BenchmarkRuleResult[] = [];

  for (const { golden, files } of targets) {
    const rule = findRule(rules, golden, options.rulesFrom);
    const documents = files.map((file) => ({
      path: file.path,
      source: file.source,
    }));
    const runs: BenchmarkRun[] = [];

    for (let index = 0; index < repeat; index += 1) {
      const result = isUnitRule(rule)
        ? await runUnitRuleOnce({
            rule,
            documents,
            units: options.units,
            choiceProvider: options.choiceProvider,
            engine: {
              concurrency,
              maxQuestionsPerRequest: maxDecisionsPerRequest,
              ...options.unitEngine,
              locateAllViolations: true,
            },
          })
        : await runEvaluationPlan({
            plan: buildEvaluationPlan({
              documents,
              rules: [rule],
              scopes,
              matchesPath: () => true,
              statuses: [rule.status],
            }),
            rules: [rule],
            provider,
            concurrency,
            maxDecisionsPerRequest,
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

async function runUnitRuleOnce(options: {
  rule: Rule;
  documents: Array<{ path: string; source: string }>;
  units: UnitRegistry | undefined;
  choiceProvider: ChoiceProvider | undefined;
  engine: Partial<UnitEngineOptions>;
}): Promise<RunResult> {
  const { rule, documents, units, choiceProvider, engine } = options;

  if (!units || !choiceProvider) {
    throw new Error(`unit ruleの評価にはunit registryとchoice providerが必要です: ${rule.id}`);
  }

  const plan = buildUnitPlan({
    documents,
    rules: [rule],
    units,
    matchesPath: () => true,
    statuses: [rule.status],
    ...(engine.unitOptions === undefined
      ? {}
      : { unitOptions: engine.unitOptions }),
  });

  return runUnitPlan({ plan, units, provider: choiceProvider, engine });
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
            ...(evaluation.locations === undefined
              ? {}
              : {
                  locations: evaluation.locations.map((location) => ({
                    startLine: location.startLine,
                    endLine: location.endLine,
                  })),
                }),
            ...(evaluation.subject.scope.startsWith("unit:")
              ? { nested: true }
              : {}),
          })),
    providerRequests: singleRule ? result.metrics.providerRequests : null,
    judgeRequests: singleRule ? (result.metrics.judgeRequests ?? null) : null,
    locateRequests: singleRule ? (result.metrics.locateRequests ?? null) : null,
    inputTokens: singleRule ? result.metrics.inputTokens : null,
    outputTokens: singleRule ? result.metrics.outputTokens : null,
    durationMs: singleRule ? result.metrics.totalDurationMs : null,
  };
}

export function findRule(
  rules: Rule[],
  golden: GoldenSet,
  rulesFrom?: string,
): Rule {
  const ruleId =
    rulesFrom === undefined
      ? golden.ruleId
      : `${rulesFrom}/${golden.ruleId.slice(golden.ruleId.indexOf("/") + 1)}`;
  const rule = rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(
      `goldenに対応するruleがありません: ${ruleId} (${golden.origin})`,
    );
  }

  return rule;
}

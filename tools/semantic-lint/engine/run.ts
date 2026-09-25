import {
  type CachedDecision,
  decisionCacheKey,
  type DecisionCache,
} from "../cache/decision-cache.ts";
import { DEFAULT_REQUEST_TOKEN_BUDGET } from "../config/config.ts";
import { buildDiagnostics, isProblem } from "../diagnostics/build.ts";
import { unitContextView } from "../units/layout.ts";
import {
  buildDecisionBatches,
} from "../planning/batches.ts";
import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  Evaluation,
  EvaluationPlan,
  EvaluationTask,
  PlannedFile,
  PlannedUnit,
  ProviderIdentity,
  ProviderRequestIdentity,
  RequestEstimator,
  RequestTokenBudget,
  Rule,
  RunResult,
  SemanticDecisionProvider,
  Subject,
} from "../domain/model.ts";

type ExecutedBatch = {
  batch: DecisionBatch;
  response: DecisionBatchResult;
  latencyMs: number;
};

/**
 * planを2段で判定する。
 *
 * 1. unitの判定: cacheにない判定だけをfileごとのrequestで問う。
 * 2. 違反箇所の特定: 違反と判定したunitのうち、partの確率をまだ持たないものについて、
 *    そのunitだけをstateに載せたrequestでpartごとに問う。違反が少ないほど1段目へ投機的に
 *    入れるより安く、判定は1段目と同じcache entryへpartの確率を足して保存する。
 */
export async function runEvaluationPlan(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  provider: SemanticDecisionProvider;
  concurrency?: number;
  requestTokenBudget?: RequestTokenBudget;
  cache?: DecisionCache;
  /**
   * trueならthreshold未満も含めて違反と判定した全unitの違反箇所を問う。
   * benchでthresholdを掃引するために使う。既定はthreshold以上のunitだけ。
   */
  locateBelowThreshold?: boolean;
  /** provider応答ごとに呼ぶ。requestの見積もりと実usageの比較などに使う。 */
  onResponse?: (batch: DecisionBatch, response: DecisionBatchResult) => void;
}): Promise<RunResult> {
  const {
    plan,
    rules,
    provider,
    concurrency = 1,
    requestTokenBudget = DEFAULT_REQUEST_TOKEN_BUDGET,
    cache,
    locateBelowThreshold = false,
    onResponse,
  } = options;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrencyは1以上の整数で指定してください。");
  }

  const startedAt = performance.now();
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const { cachedEvaluations, cacheKeys, batches } = planRequests({
    plan,
    rules,
    requestIdentity: provider.requestIdentity,
    estimator: provider,
    budget: requestTokenBudget,
    ...(cache === undefined ? {} : { cache }),
  });
  const decided = new Map<string, CachedDecision>(
    [...cachedEvaluations].map(([taskId, evaluation]) => [
      taskId,
      { result: evaluation.result, provider: evaluation.provider },
    ]),
  );
  const providerLatencies: number[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  const execute = (requests: DecisionBatch[]) =>
    mapConcurrent(requests, concurrency, async (batch) => {
      const providerStartedAt = performance.now();
      const response = await provider.evaluate(batch);
      providerLatencies.push(performance.now() - providerStartedAt);
      inputTokens += response.usage.inputTokens;
      outputTokens += response.usage.outputTokens;
      onResponse?.(batch, response);
      const updated = applyResponse(decided, batch, response);

      if (cache) {
        await storeDecisions(cache, cacheKeys, decided, updated);
      }
    });

  await execute(batches);

  const locatePlan: EvaluationPlan = {
    files: plan.files.flatMap((file) => {
      const unitsById = new Map(file.units.map((unit) => [unit.id, unit]));
      const tasks = file.tasks
        .filter((task) => {
          const decision = decided.get(task.id)?.result;
          const rule = rulesById.get(task.ruleId);

          return (
            decision !== undefined &&
            rule !== undefined &&
            decision.decision === "violation" &&
            decision.parts === undefined &&
            (locateBelowThreshold ||
              decision.probabilities.violation >= rule.violationThreshold) &&
            (unitsById.get(task.subjectId)?.parts.length ?? 0) > 0
          );
        })
        .map((task) => ({ ...task, locate: true }));

      return tasks.length === 0 ? [] : [{ ...file, tasks }];
    }),
  };
  const locateBatches = buildDecisionBatches({
    plan: locatePlan,
    rules,
    estimator: provider,
    budget: requestTokenBudget,
  });

  await execute(locateBatches);

  const evaluations = plan.files.flatMap((file) => {
    const unitsById = new Map(file.units.map((unit) => [unit.id, unit]));

    return file.tasks.map((task) => {
      const decision = decided.get(task.id);
      const unit = unitsById.get(task.subjectId);

      if (!decision || !unit) {
        throw new Error(`判定結果がありません: ${task.id}`);
      }

      return createEvaluation(task, unit, decision.result, decision.provider);
    });
  });
  const { diagnostics, unknowns } = buildDiagnostics({
    evaluations,
    rules,
  });
  const decisionRequests = batches.reduce(
    (sum, batch) => sum + batch.requests.length,
    0,
  );
  const providerDecisions =
    decisionRequests +
    locateBatches.reduce((sum, batch) => sum + batch.requests.length, 0);

  return {
    schemaVersion: 1,
    diagnostics,
    unknowns,
    evaluations,
    metrics: {
      scannedFiles: plan.files.length,
      subjects: plan.files.reduce(
        (sum, file) => sum + file.units.length,
        0,
      ),
      plannedEvaluations: plan.files.reduce(
        (sum, file) => sum + file.tasks.length,
        0,
      ),
      providerRequests: batches.length + locateBatches.length,
      providerDecisions,
      diagnostics: diagnostics.filter(isProblem).length,
      unknowns: unknowns.length,
      inputTokens,
      outputTokens,
      cache: {
        enabled: cache !== undefined,
        hits: cachedEvaluations.size,
        misses: cache ? decisionRequests : 0,
      },
      totalDurationMs: performance.now() - startedAt,
      providerLatencyMs: providerLatencies,
    },
  };
}

/** provider応答をtaskごとの判定へ反映し、更新したtask idを返す。 */
function applyResponse(
  decided: Map<string, CachedDecision>,
  batch: DecisionBatch,
  response: DecisionBatchResult,
): string[] {
  const updated: string[] = [];

  for (const request of batch.requests) {
    if (request.locate) {
      const current = decided.get(request.taskId);
      const parts = response.locations[request.taskId];

      if (!current || !parts) {
        throw new Error(
          `provider responseに違反箇所の判定がありません: ${request.taskId}`,
        );
      }

      decided.set(request.taskId, {
        result: { ...current.result, parts },
        provider: current.provider,
      });
    } else {
      const result = response.decisions[request.taskId];

      if (!result) {
        throw new Error(
          `provider responseに判定がありません: ${request.taskId}`,
        );
      }

      decided.set(request.taskId, { result, provider: response.provider });
    }

    updated.push(request.taskId);
  }

  return updated;
}

export type PlannedRequests = {
  cachedEvaluations: Map<string, Evaluation>;
  cacheKeys: Map<string, string>;
  batches: DecisionBatch[];
};

/** cacheにhitしなかったtaskだけをrequestへまとめる。providerは呼ばない。 */
export function planRequests(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  requestIdentity: ProviderRequestIdentity;
  estimator: RequestEstimator;
  budget: RequestTokenBudget;
  cache?: DecisionCache;
}): PlannedRequests {
  const { plan, rules, requestIdentity, estimator, budget, cache } = options;
  const { cachedEvaluations, cacheKeys, missPlan } = cache
    ? lookupCache({ plan, rules, requestIdentity, cache })
    : {
        cachedEvaluations: new Map<string, Evaluation>(),
        cacheKeys: new Map<string, string>(),
        missPlan: plan,
      };

  return {
    cachedEvaluations,
    cacheKeys,
    batches: buildDecisionBatches({ plan: missPlan, rules, estimator, budget }),
  };
}

/**
 * taskごとにキャッシュを引き、missしたtaskだけを残したplanを作る。
 * batchはmiss分だけから組み立てるため、同じfileの一部だけmissしてもmiss分だけ送る。
 */
function lookupCache(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  requestIdentity: ProviderRequestIdentity;
  cache: DecisionCache;
}): {
  cachedEvaluations: Map<string, Evaluation>;
  cacheKeys: Map<string, string>;
  missPlan: EvaluationPlan;
} {
  const { plan, rules, requestIdentity, cache } = options;
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const cachedEvaluations = new Map<string, Evaluation>();
  const cacheKeys = new Map<string, string>();
  const missFiles: PlannedFile[] = [];

  for (const file of plan.files) {
    const subjectsById = new Map(
      file.units.map((unit) => [unit.id, unit]),
    );
    const missTasks: EvaluationTask[] = [];
    const contexts = new Map<string, string>();

    for (const task of file.tasks) {
      const rule = rulesById.get(task.ruleId);
      const subject = subjectsById.get(task.subjectId);

      if (!rule) {
        throw new Error(`planが未知のruleを参照しています: ${task.ruleId}`);
      }

      if (!subject) {
        throw new Error(`planにsubjectがありません: ${task.subjectId}`);
      }

      let context = contexts.get(subject.id);

      if (context === undefined) {
        context = unitContextView({
          file: { path: file.path, source: file.source },
          marker: file.marker,
          units: file.units,
          target: subject,
        });
        contexts.set(subject.id, context);
      }

      const key = decisionCacheKey({
        provider: requestIdentity,
        unit: rule.unit,
        instruction: rule.instruction,
        path: file.path,
        context,
        parts: subject.parts.map(
          (part): [number, number] => [
            part.span.start - subject.span.start,
            part.span.end - subject.span.start,
          ],
        ),
      });
      const cached = cache.get(key);
      cacheKeys.set(task.id, key);

      if (cached) {
        cachedEvaluations.set(
          task.id,
          createEvaluation(task, subject, cached.result, cached.provider),
        );
        continue;
      }

      missTasks.push(task);
    }

    if (missTasks.length > 0) {
      missFiles.push({ ...file, tasks: missTasks });
    }
  }

  return {
    cachedEvaluations,
    cacheKeys,
    missPlan: { files: missFiles },
  };
}

async function storeDecisions(
  cache: DecisionCache,
  cacheKeys: Map<string, string>,
  decided: Map<string, CachedDecision>,
  taskIds: readonly string[],
): Promise<void> {
  for (const taskId of taskIds) {
    const key = cacheKeys.get(taskId);
    const value = decided.get(taskId);

    if (key === undefined || value === undefined) {
      continue;
    }

    await cache.put(key, value);
  }
}

function createEvaluation(
  task: Pick<EvaluationTask, "id" | "ruleId">,
  unit: PlannedUnit,
  result: DecisionResult,
  provider: ProviderIdentity,
): Evaluation {
  const parts = result.parts;

  return {
    taskId: task.id,
    ruleId: task.ruleId,
    subject: publicSubject(unit),
    result,
    ...(parts === undefined || parts.length !== unit.parts.length
      ? {}
      : {
          parts: unit.parts.map((part, index) => ({
            kind: part.kind,
            range: part.range,
            probability: parts[index] ?? 0,
          })),
        }),
    provider,
  };
}

/** 実行結果に残すsubject。plan内部の入れ子・文脈の情報は含めない。 */
function publicSubject(unit: PlannedUnit): Subject {
  return {
    id: unit.id,
    unit: unit.unit,
    path: unit.path,
    range: unit.range,
    ...(unit.symbol === undefined ? {} : { symbol: unit.symbol }),
    source: unit.source,
    ...(unit.reportRange === undefined ? {} : { reportRange: unit.reportRange }),
  };
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      const value = values[index];

      if (value === undefined) {
        return;
      }

      results[index] = await mapper(value);
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

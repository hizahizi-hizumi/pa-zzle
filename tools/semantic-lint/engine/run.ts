import {
  decisionCacheKey,
  type DecisionCache,
} from "../cache/decision-cache.ts";
import { DEFAULT_REQUEST_TOKEN_BUDGET } from "../config/config.ts";
import { buildDiagnostics } from "../diagnostics/build.ts";
import {
  buildDecisionBatches,
} from "../planning/batches.ts";
import type {
  DecisionBatch,
  DecisionBatchResult,
  Evaluation,
  EvaluationPlan,
  EvaluationTask,
  PlannedFile,
  PlannedUnit,
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

export async function runEvaluationPlan(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  provider: SemanticDecisionProvider;
  concurrency?: number;
  requestTokenBudget?: RequestTokenBudget;
  cache?: DecisionCache;
}): Promise<RunResult> {
  const {
    plan,
    rules,
    provider,
    concurrency = 1,
    requestTokenBudget = DEFAULT_REQUEST_TOKEN_BUDGET,
    cache,
  } = options;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrencyは1以上の整数で指定してください。");
  }

  const startedAt = performance.now();
  const { cachedEvaluations, cacheKeys, missPlan } = cache
    ? lookupCache({ plan, rules, provider, cache })
    : {
        cachedEvaluations: new Map<string, Evaluation>(),
        cacheKeys: new Map<string, string>(),
        missPlan: plan,
      };
  const batches = buildDecisionBatches({
    plan: missPlan,
    rules,
    estimator: provider,
    budget: requestTokenBudget,
  });
  const executed = await mapConcurrent(
    batches,
    concurrency,
    async (batch): Promise<ExecutedBatch> => {
      const providerStartedAt = performance.now();
      const response = await provider.evaluate(batch);
      const latencyMs = performance.now() - providerStartedAt;

      if (cache) {
        await storeDecisions(cache, cacheKeys, batch, response);
      }

      return {
        batch,
        response,
        latencyMs,
      };
    },
  );

  const freshEvaluations = new Map<string, Evaluation>();
  const providerLatencies: number[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const execution of executed) {
    providerLatencies.push(execution.latencyMs);
    inputTokens += execution.response.usage.inputTokens;
    outputTokens += execution.response.usage.outputTokens;
    appendEvaluations(freshEvaluations, execution.batch, execution.response);
  }

  const evaluations = plan.files.flatMap((file) =>
    file.tasks.map((task) => {
      const evaluation =
        cachedEvaluations.get(task.id) ?? freshEvaluations.get(task.id);

      if (!evaluation) {
        throw new Error(`判定結果がありません: ${task.id}`);
      }

      return evaluation;
    }),
  );
  const { diagnostics, unknowns } = buildDiagnostics({
    evaluations,
    rules,
  });
  const providerDecisions = batches.reduce(
    (sum, batch) => sum + batch.requests.length,
    0,
  );

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
      providerRequests: batches.length,
      providerDecisions,
      diagnostics: diagnostics.length,
      unknowns: unknowns.length,
      inputTokens,
      outputTokens,
      cache: {
        enabled: cache !== undefined,
        hits: cachedEvaluations.size,
        misses: cache ? providerDecisions : 0,
      },
      totalDurationMs: performance.now() - startedAt,
      providerLatencyMs: providerLatencies,
    },
  };
}

/**
 * taskごとにキャッシュを引き、missしたtaskだけを残したplanを作る。
 * batchはmiss分だけから組み立てるため、同じfileの一部だけmissしてもmiss分だけ送る。
 */
function lookupCache(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  provider: SemanticDecisionProvider;
  cache: DecisionCache;
}): {
  cachedEvaluations: Map<string, Evaluation>;
  cacheKeys: Map<string, string>;
  missPlan: EvaluationPlan;
} {
  const { plan, rules, provider, cache } = options;
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const cachedEvaluations = new Map<string, Evaluation>();
  const cacheKeys = new Map<string, string>();
  const missFiles: PlannedFile[] = [];

  for (const file of plan.files) {
    const subjectsById = new Map(
      file.units.map((unit) => [unit.id, unit]),
    );
    const missTasks: EvaluationTask[] = [];

    for (const task of file.tasks) {
      const rule = rulesById.get(task.ruleId);
      const subject = subjectsById.get(task.subjectId);

      if (!rule) {
        throw new Error(`planが未知のruleを参照しています: ${task.ruleId}`);
      }

      if (!subject) {
        throw new Error(`planにsubjectがありません: ${task.subjectId}`);
      }

      const key = decisionCacheKey({
        provider: provider.requestIdentity,
        unit: rule.unit,
        predicate: rule.predicate,
        file: { path: file.path, source: file.source },
        subject,
      });
      const cached = cache.get(key);

      if (cached) {
        cachedEvaluations.set(task.id, {
          taskId: task.id,
          ruleId: task.ruleId,
          subject: publicSubject(subject),
          result: cached.result,
          provider: cached.provider,
        });
        continue;
      }

      cacheKeys.set(task.id, key);
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
  batch: DecisionBatch,
  response: DecisionBatchResult,
): Promise<void> {
  for (const request of batch.requests) {
    const key = cacheKeys.get(request.taskId);
    const result = response.decisions[request.taskId];

    if (key === undefined || result === undefined) {
      continue;
    }

    await cache.put(key, { result, provider: response.provider });
  }
}

function appendEvaluations(
  evaluations: Map<string, Evaluation>,
  batch: DecisionBatch,
  response: DecisionBatchResult,
): void {
  const subjectsById = new Map(batch.units.map((unit) => [unit.id, unit]));

  for (const request of batch.requests) {
    const result = response.decisions[request.taskId];
    const subject = subjectsById.get(request.subjectId);

    if (!result) {
      throw new Error(
        `provider responseに判定がありません: ${request.taskId}`,
      );
    }

    if (!subject) {
      throw new Error(`batchにsubjectがありません: ${request.subjectId}`);
    }

    evaluations.set(request.taskId, {
      taskId: request.taskId,
      ruleId: request.ruleId,
      subject: publicSubject(subject),
      result,
      provider: response.provider,
    });
  }
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

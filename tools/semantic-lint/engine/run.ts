import { buildDiagnostics } from "../diagnostics/build.ts";
import {
  buildDecisionBatches,
} from "../planning/batches.ts";
import type {
  DecisionBatch,
  DecisionBatchResult,
  Evaluation,
  EvaluationPlan,
  Rule,
  RunResult,
  SemanticDecisionProvider,
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
  maxDecisionsPerRequest?: number;
}): Promise<RunResult> {
  const {
    plan,
    rules,
    provider,
    concurrency = 1,
    maxDecisionsPerRequest = 64,
  } = options;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrencyは1以上の整数で指定してください。");
  }

  const startedAt = performance.now();
  const batches = buildDecisionBatches({
    plan,
    rules,
    maxDecisionsPerRequest,
  });
  const executed = await mapConcurrent(
    batches,
    concurrency,
    async (batch): Promise<ExecutedBatch> => {
      const providerStartedAt = performance.now();
      const response = await provider.evaluate(batch);

      return {
        batch,
        response,
        latencyMs: performance.now() - providerStartedAt,
      };
    },
  );

  const evaluations: Evaluation[] = [];
  const providerLatencies: number[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const execution of executed) {
    providerLatencies.push(execution.latencyMs);
    inputTokens += execution.response.usage.inputTokens;
    outputTokens += execution.response.usage.outputTokens;
    appendEvaluations(evaluations, execution.batch, execution.response);
  }

  const { diagnostics, unknowns } = buildDiagnostics({
    evaluations,
    rules,
  });

  return {
    schemaVersion: 1,
    diagnostics,
    unknowns,
    evaluations,
    metrics: {
      scannedFiles: plan.files.length,
      subjects: plan.files.reduce(
        (sum, file) => sum + file.subjects.length,
        0,
      ),
      plannedEvaluations: plan.files.reduce(
        (sum, file) => sum + file.tasks.length,
        0,
      ),
      providerRequests: batches.length,
      providerDecisions: batches.reduce(
        (sum, batch) => sum + batch.requests.length,
        0,
      ),
      diagnostics: diagnostics.length,
      unknowns: unknowns.length,
      inputTokens,
      outputTokens,
      totalDurationMs: performance.now() - startedAt,
      providerLatencyMs: providerLatencies,
    },
  };
}

function appendEvaluations(
  evaluations: Evaluation[],
  batch: DecisionBatch,
  response: DecisionBatchResult,
): void {
  const subjectsById = new Map(
    batch.subjects.map((subject) => [subject.id, subject]),
  );

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

    evaluations.push({
      taskId: request.taskId,
      ruleId: request.ruleId,
      subject,
      result,
      provider: response.provider,
    });
  }
}

export async function mapConcurrent<T, R>(
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

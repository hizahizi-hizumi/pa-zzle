import { buildDiagnostics } from "../diagnostics/build.ts";
import type {
  DecisionBatch,
  DecisionBatchResult,
  Evaluation,
  EvaluationPlan,
  Rule,
  RunResult,
  SemanticDecisionProvider,
  Subject,
} from "../domain/model.ts";

type PlannedBatch = {
  batch: DecisionBatch;
  tasks: EvaluationPlan["files"][number]["tasks"];
  subjectsById: Map<string, Subject>;
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

  if (!Number.isInteger(maxDecisionsPerRequest) || maxDecisionsPerRequest < 1) {
    throw new Error("maxDecisionsPerRequestは1以上の整数で指定してください。");
  }

  const startedAt = performance.now();
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const plannedBatches = createBatches(
    plan,
    rulesById,
    maxDecisionsPerRequest,
  );
  const executed = await mapConcurrent(
    plannedBatches,
    concurrency,
    async (planned) => {
      const providerStartedAt = performance.now();
      const response = await provider.evaluate(planned.batch);

      return {
        planned,
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
    const { planned, response, latencyMs } = execution;
    providerLatencies.push(latencyMs);
    inputTokens += response.usage.inputTokens;
    outputTokens += response.usage.outputTokens;

    appendEvaluations({
      evaluations,
      planned,
      response,
    });
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
      providerRequests: plannedBatches.length,
      providerDecisions: plannedBatches.reduce(
        (sum, planned) => sum + planned.tasks.length,
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

function createBatches(
  plan: EvaluationPlan,
  rulesById: Map<string, Rule>,
  maxDecisionsPerRequest: number,
): PlannedBatch[] {
  const batches: PlannedBatch[] = [];

  for (const file of plan.files) {
    const subjectsById = new Map(
      file.subjects.map((subject) => [subject.id, subject]),
    );

    for (
      let offset = 0;
      offset < file.tasks.length;
      offset += maxDecisionsPerRequest
    ) {
      const tasks = file.tasks.slice(offset, offset + maxDecisionsPerRequest);
      batches.push({
        batch: createBatch(
          file.path,
          file.source,
          file.subjects,
          tasks,
          rulesById,
          offset / maxDecisionsPerRequest,
        ),
        tasks,
        subjectsById,
      });
    }
  }

  return batches;
}

function appendEvaluations(options: {
  evaluations: Evaluation[];
  planned: PlannedBatch;
  response: DecisionBatchResult;
}): void {
  const { evaluations, planned, response } = options;

  for (const task of planned.tasks) {
    const result = response.decisions[task.id];
    const subject = planned.subjectsById.get(task.subjectId);

    if (!result) {
      throw new Error(`provider responseに判定がありません: ${task.id}`);
    }

    if (!subject) {
      throw new Error(`planにsubjectがありません: ${task.subjectId}`);
    }

    evaluations.push({
      taskId: task.id,
      ruleId: task.ruleId,
      subject,
      result,
      provider: response.provider,
    });
  }
}

function createBatch(
  path: string,
  source: string,
  subjects: Subject[],
  tasks: EvaluationPlan["files"][number]["tasks"],
  rulesById: Map<string, Rule>,
  chunkIndex: number,
): DecisionBatch {
  const taskSubjectIds = new Set(tasks.map((task) => task.subjectId));
  const batchSubjects = subjects.filter((subject) =>
    taskSubjectIds.has(subject.id),
  );

  return {
    id: `${path}#${chunkIndex}`,
    file: { path, source },
    subjects: batchSubjects,
    requests: tasks.map((task) => {
      const rule = rulesById.get(task.ruleId);

      if (!rule) {
        throw new Error(`planが未知のruleを参照しています: ${task.ruleId}`);
      }

      return {
        taskId: task.id,
        ruleId: rule.id,
        subjectId: task.subjectId,
        predicate: rule.predicate,
      };
    }),
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

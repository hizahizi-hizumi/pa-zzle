import { buildDiagnostics } from "../diagnostics/build.ts";
import type {
  DecisionBatch,
  Evaluation,
  EvaluationPlan,
  Rule,
  RunResult,
  SemanticDecisionProvider,
  Subject,
} from "../domain/model.ts";

export async function runEvaluationPlan(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest?: number;
}): Promise<RunResult> {
  const {
    plan,
    rules,
    provider,
    maxDecisionsPerRequest = 64,
  } = options;

  if (!Number.isInteger(maxDecisionsPerRequest) || maxDecisionsPerRequest < 1) {
    throw new Error("maxDecisionsPerRequestは1以上の整数で指定してください。");
  }

  const startedAt = performance.now();
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const evaluations: Evaluation[] = [];
  const providerLatencies: number[] = [];
  let providerRequests = 0;
  let providerDecisions = 0;
  let inputTokens = 0;
  let outputTokens = 0;

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
      const batch = createBatch(
        file.path,
        file.source,
        file.subjects,
        tasks,
        rulesById,
        offset / maxDecisionsPerRequest,
      );
      const providerStartedAt = performance.now();
      const response = await provider.evaluate(batch);
      providerLatencies.push(performance.now() - providerStartedAt);
      providerRequests += 1;
      providerDecisions += tasks.length;
      inputTokens += response.usage.inputTokens;
      outputTokens += response.usage.outputTokens;

      for (const task of tasks) {
        const result = response.decisions[task.id];
        const subject = subjectsById.get(task.subjectId);

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
      providerRequests,
      providerDecisions,
      diagnostics: diagnostics.length,
      unknowns: unknowns.length,
      inputTokens,
      outputTokens,
      totalDurationMs: performance.now() - startedAt,
      providerLatencyMs: providerLatencies,
    },
  };
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

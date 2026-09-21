import type {
  DecisionBatch,
  EvaluationPlan,
  Rule,
} from "../domain/model.ts";

export function buildDecisionBatches(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  maxDecisionsPerRequest: number;
}): DecisionBatch[] {
  const { plan, rules, maxDecisionsPerRequest } = options;

  if (!Number.isInteger(maxDecisionsPerRequest) || maxDecisionsPerRequest < 1) {
    throw new Error("maxDecisionsPerRequestは1以上の整数で指定してください。");
  }

  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const batches: DecisionBatch[] = [];

  for (const file of plan.files) {
    for (
      let offset = 0;
      offset < file.tasks.length;
      offset += maxDecisionsPerRequest
    ) {
      const tasks = file.tasks.slice(offset, offset + maxDecisionsPerRequest);
      const subjectIds = new Set(tasks.map((task) => task.subjectId));
      const subjects = file.subjects.filter((subject) =>
        subjectIds.has(subject.id),
      );

      batches.push({
        id: `${file.path}#${offset / maxDecisionsPerRequest}`,
        file: {
          path: file.path,
          source: file.source,
        },
        subjects,
        requests: tasks.map((task) => {
          const rule = rulesById.get(task.ruleId);

          if (!rule) {
            throw new Error(
              `planが未知のruleを参照しています: ${task.ruleId}`,
            );
          }

          return {
            taskId: task.id,
            ruleId: rule.id,
            subjectId: task.subjectId,
            predicate: rule.predicate,
          };
        }),
      });
    }
  }

  return batches;
}

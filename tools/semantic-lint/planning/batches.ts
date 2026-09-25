import type {
  DecisionBatch,
  EvaluationPlan,
  EvaluationTask,
  PlannedFile,
  RequestEstimator,
  RequestTokenBudget,
  Rule,
} from "../domain/model.ts";
import { subjectClosure } from "../units/layout.ts";

/**
 * fileごとにtaskをrequestへまとめる。
 *
 * stateとrequest固定費をfileあたり1回にするため、全rule × 全unitを1 requestに入れる。
 * token予算を超える場合だけ、unitの出現順に予算内へ収まるまで分割する。
 */
export function buildDecisionBatches(options: {
  plan: EvaluationPlan;
  rules: Rule[];
  estimator: RequestEstimator;
  budget: RequestTokenBudget;
}): DecisionBatch[] {
  const { plan, rules, estimator, budget } = options;
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const batches: DecisionBatch[] = [];

  for (const file of plan.files) {
    if (file.tasks.length === 0) {
      continue;
    }

    const makeBatch = (tasks: EvaluationTask[]): DecisionBatch =>
      createBatch(file, tasks, rulesById, `${file.path}#${batches.length}`);
    const whole = makeBatch(file.tasks);

    if (fitsBudget(estimator, whole, budget)) {
      batches.push(whole);
      continue;
    }

    let current: EvaluationTask[] = [];

    for (const task of tasksInSourceOrder(file)) {
      const candidate = [...current, task];

      if (
        current.length === 0 ||
        fitsBudget(estimator, makeBatch(candidate), budget)
      ) {
        current = candidate;
        continue;
      }

      batches.push(makeBatch(current));
      current = [task];
    }

    if (current.length > 0) {
      batches.push(makeBatch(current));
    }
  }

  return batches;
}

function fitsBudget(
  estimator: RequestEstimator,
  batch: DecisionBatch,
  budget: RequestTokenBudget,
): boolean {
  const estimate = estimator.estimate(batch);
  const longestQuestion = Math.max(0, ...estimate.questions);

  return (
    estimate.state + longestQuestion <= budget.stateAndQuestion &&
    estimate.total <= budget.total
  );
}

function createBatch(
  file: PlannedFile,
  tasks: EvaluationTask[],
  rulesById: Map<string, Rule>,
  id: string,
): DecisionBatch {
  return {
    id,
    file: {
      path: file.path,
      source: file.source,
    },
    marker: file.marker,
    units: file.units,
    subjectIds: subjectClosure(
      file.units,
      new Set(tasks.map((task) => task.subjectId)),
    ),
    requests: tasks.map((task) => {
      const rule = rulesById.get(task.ruleId);

      if (!rule) {
        throw new Error(`planが未知のruleを参照しています: ${task.ruleId}`);
      }

      return {
        taskId: task.id,
        ruleId: rule.id,
        subjectId: task.subjectId,
        instruction: rule.instruction,
        ...(task.locate ? { locate: true } : {}),
      };
    }),
  };
}

/** 分割時に同じunitのtaskが同じrequestへ入りやすいよう、unitの出現順に並べる。 */
function tasksInSourceOrder(file: PlannedFile): EvaluationTask[] {
  const order = new Map(file.units.map((unit, index) => [unit.id, index]));

  return file.tasks
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        (order.get(left.task.subjectId) ?? 0) -
          (order.get(right.task.subjectId) ?? 0) || left.index - right.index,
    )
    .map(({ task }) => task);
}

import { relative, sep } from "node:path";

import type { GoldenCase } from "../config/cases.ts";
import type {
  DecisionResult,
  EvaluationPlan,
  Rule,
  SemanticDecisionProvider,
} from "../domain/model.ts";
import { runEvaluationPlan } from "../engine/run.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import type { ScopeRegistry } from "../scopes/registry.ts";

export type GoldenCaseRun = {
  result: DecisionResult;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export type GoldenCaseResult = {
  case: GoldenCase;
  rule: Rule;
  runs: GoldenCaseRun[];
};

export async function runGoldenCases(options: {
  projectRoot: string;
  cases: GoldenCase[];
  rules: Rule[];
  scopes: ScopeRegistry;
  provider: SemanticDecisionProvider;
  repeat: number;
  concurrency: number;
  maxDecisionsPerRequest: number;
}): Promise<GoldenCaseResult[]> {
  const {
    projectRoot,
    cases,
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

  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const prepared = await Promise.all(
    cases.map(async (goldenCase) => {
      const rule = rulesById.get(goldenCase.ruleId);

      if (!rule) {
        throw new Error(
          `golden caseが未知のruleを参照しています: ${goldenCase.ruleId}`,
        );
      }

      const source = await Bun.file(goldenCase.fixturePath).text();
      const path = relative(projectRoot, goldenCase.fixturePath)
        .split(sep)
        .join("/");
      const plan = buildEvaluationPlan({
        documents: [{ path, source }],
        rules: [rule],
        scopes,
        matchesPath: () => true,
        statuses: [rule.status],
      });

      return {
        case: goldenCase,
        rule,
        plan: selectCasePlan(plan, goldenCase),
      };
    }),
  );

  const tasks = prepared.flatMap((item, caseIndex) =>
    Array.from({ length: repeat }, (_, runIndex) => ({
      caseIndex,
      runIndex,
      item,
    })),
  );
  const executed = await mapConcurrent(
    tasks,
    concurrency,
    async ({ caseIndex, runIndex, item }) => {
      const startedAt = performance.now();
      const result = await runEvaluationPlan({
        plan: item.plan,
        rules: [item.rule],
        provider,
        concurrency: 1,
        maxDecisionsPerRequest,
      });
      const evaluation = result.evaluations[0];

      if (!evaluation) {
        throw new Error(
          `golden caseの判定結果がありません: ${item.case.name}`,
        );
      }

      return {
        caseIndex,
        runIndex,
        run: {
          result: evaluation.result,
          inputTokens: result.metrics.inputTokens,
          outputTokens: result.metrics.outputTokens,
          durationMs: performance.now() - startedAt,
        } satisfies GoldenCaseRun,
      };
    },
  );

  const grouped = prepared.map((item) => ({
    case: item.case,
    rule: item.rule,
    runs: new Array<GoldenCaseRun>(repeat),
  }));

  for (const execution of executed) {
    const result = grouped[execution.caseIndex];

    if (!result) {
      throw new Error("golden case結果の集約に失敗しました。");
    }

    result.runs[execution.runIndex] = execution.run;
  }

  return grouped;
}

function selectCasePlan(
  plan: EvaluationPlan,
  goldenCase: GoldenCase,
): EvaluationPlan {
  const file = plan.files[0];

  if (!file) {
    throw new Error(
      `fixtureから評価対象を抽出できません: ${goldenCase.name}`,
    );
  }

  if (goldenCase.subjectSymbol === undefined) {
    if (file.tasks.length !== 1) {
      throw new Error(
        `fixtureの評価対象が${file.tasks.length}件あります。subject.symbolを指定してください: ${goldenCase.name}`,
      );
    }

    return plan;
  }

  const subject = file.subjects.find(
    (candidate) => candidate.symbol === goldenCase.subjectSymbol,
  );

  if (!subject) {
    throw new Error(
      `fixtureにsubjectがありません: ${goldenCase.subjectSymbol}`,
    );
  }

  const task = file.tasks.find((candidate) => candidate.subjectId === subject.id);

  if (!task) {
    throw new Error(
      `fixtureにsubjectのtaskがありません: ${goldenCase.subjectSymbol}`,
    );
  }

  return {
    files: [
      {
        ...file,
        subjects: [subject],
        tasks: [task],
      },
    ],
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

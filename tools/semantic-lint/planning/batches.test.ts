import { describe, expect, test } from "bun:test";

import type {
  DecisionBatch,
  EvaluationPlan,
  RequestEstimate,
  RequestEstimator,
  Rule,
} from "../domain/model.ts";
import { estimateTypeSafeRequest } from "../providers/typesafe/provider.ts";
import { sampleRule, testExtractor } from "../testing/fixtures.ts";
import { buildDecisionBatches } from "./batches.ts";
import { buildEvaluationPlan } from "./planner.ts";

const extractor = await testExtractor();

const source = `describe("計算", () => {
  beforeEach(() => {
    reset();
  });

${Array.from(
  { length: 6 },
  (_, index) => `  test("ケース${index}", () => {
    expect(calculate(${index})).toBe(${index * 2});
  });
`,
).join("\n")}});
`;

const rules: Rule[] = [
  sampleRule({ id: "vitest/test-a", unit: "test" }),
  sampleRule({ id: "vitest/test-b", unit: "test" }),
  sampleRule({ id: "vitest/group", unit: "test-group" }),
  sampleRule({ id: "vitest/setup", unit: "setup" }),
];

function plan(): EvaluationPlan {
  return buildEvaluationPlan({
    documents: [{ path: "a.test.ts", source }],
    rules,
    extractor,
    matchesPath: () => true,
  });
}

const typeSafe: RequestEstimator = {
  estimate: (batch) => estimateTypeSafeRequest("jev-latest", batch),
};

function estimates(batches: DecisionBatch[]): RequestEstimate[] {
  return batches.map((batch) => typeSafe.estimate(batch));
}

describe("buildDecisionBatches", () => {
  test("token予算に収まるfileは全rule × 全unitを1 requestにまとめる", () => {
    const evaluationPlan = plan();
    const batches = buildDecisionBatches({
      plan: evaluationPlan,
      rules,
      estimator: typeSafe,
      budget: { stateAndQuestion: 32_000, total: 64_000 },
    });

    expect(batches).toHaveLength(1);
    expect(batches[0]?.requests.map((request) => request.taskId)).toEqual(
      evaluationPlan.files[0]?.tasks.map((task) => task.id),
    );
    expect(batches[0]?.subjectIds).toHaveLength(8);
  });

  test("予算を超えるfileはunitの出現順に予算内のrequestへ分割する", () => {
    const evaluationPlan = plan();
    const whole = estimates(
      buildDecisionBatches({
        plan: evaluationPlan,
        rules,
        estimator: typeSafe,
        budget: { stateAndQuestion: 32_000, total: 64_000 },
      }),
    )[0];
    const budget = {
      stateAndQuestion: 32_000,
      total: Math.floor((whole?.total ?? 0) / 2),
    };
    const batches = buildDecisionBatches({
      plan: evaluationPlan,
      rules,
      estimator: typeSafe,
      budget,
    });

    expect(batches.length).toBeGreaterThan(1);

    for (const estimate of estimates(batches)) {
      expect(estimate.total).toBeLessThanOrEqual(budget.total);
    }

    expect(
      batches
        .flatMap((batch) => batch.requests.map((request) => request.taskId))
        .sort(),
    ).toEqual(
      (evaluationPlan.files[0]?.tasks ?? []).map((task) => task.id).sort(),
    );
  });

  test("分割したrequestにも判定対象の祖先と文脈のunitを載せる", () => {
    const evaluationPlan = plan();
    const units = evaluationPlan.files[0]?.units ?? [];
    const symbolOf = (id: string) =>
      units.find((unit) => unit.id === id)?.symbol;
    const batches = buildDecisionBatches({
      plan: evaluationPlan,
      rules,
      estimator: typeSafe,
      budget: { stateAndQuestion: 32_000, total: 2_000 },
    });
    const lastTest = batches.find((batch) =>
      batch.requests.some(
        (request) => symbolOf(request.subjectId) === 'test("ケース5")',
      ),
    );

    expect(lastTest?.subjectIds.map(symbolOf)).toEqual(
      expect.arrayContaining([
        'describe("計算")',
        "beforeEach",
        'test("ケース5")',
      ]),
    );
  });

  test("1判定だけで予算を超える場合もそのtaskだけのrequestにする", () => {
    const evaluationPlan = plan();
    const batches = buildDecisionBatches({
      plan: evaluationPlan,
      rules,
      estimator: typeSafe,
      budget: { stateAndQuestion: 1, total: 1 },
    });

    expect(batches.map((batch) => batch.requests.length)).toEqual(
      evaluationPlan.files[0]?.tasks.map(() => 1) ?? [],
    );
  });
});

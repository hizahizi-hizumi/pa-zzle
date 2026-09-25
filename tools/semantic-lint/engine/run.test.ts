import { describe, expect, test } from "bun:test";

import { runEvaluationPlan } from "./run.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import { FakeDecisionProvider } from "../testing/fake-provider.ts";
import {
  decisionResult,
  sampleRule,
  testExtractor,
} from "../testing/fixtures.ts";

const extractor = await testExtractor();

describe("runEvaluationPlan", () => {
  test("thresholdを一度だけ適用してcanonical diagnosticを作る", async () => {
    const rule = sampleRule();
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: "const value = 1;\n",
        },
      ],
      rules: [rule],
      extractor,
      matchesPath: () => true,
    });
    const task = plan.files[0]?.tasks[0];

    if (!task) {
      throw new Error("test plan is empty");
    }

    const provider = new FakeDecisionProvider({
      [task.id]: decisionResult("violation", 0.95),
    });

    const result = await runEvaluationPlan({
      plan,
      rules: [rule],
      provider,
    });

    // unitの判定と、違反と判定したunitの違反箇所の判定の2 request。
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.requests[0]?.locate).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      ruleId: "vitest/sample",
      path: "frontend/example.test.ts",
      probability: 0.95,
      severity: "warning",
    });
    expect(result.metrics.plannedEvaluations).toBe(1);
    expect(result.metrics.providerDecisions).toBe(2);
  });

  test("threshold未満のviolationをdiagnosticにしない", async () => {
    const rule = sampleRule();
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: "const value = 1;\n",
        },
      ],
      rules: [rule],
      extractor,
      matchesPath: () => true,
    });
    const task = plan.files[0]?.tasks[0];

    if (!task) {
      throw new Error("test plan is empty");
    }

    const result = await runEvaluationPlan({
      plan,
      rules: [rule],
      provider: new FakeDecisionProvider({
        [task.id]: decisionResult("violation", 0.89),
      }),
    });

    expect(result.diagnostics).toEqual([]);
  });

  test("cannot_judgeをunknownとして保持する", async () => {
    const rule = sampleRule();
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: "const value = 1;\n",
        },
      ],
      rules: [rule],
      extractor,
      matchesPath: () => true,
    });
    const task = plan.files[0]?.tasks[0];

    if (!task) {
      throw new Error("test plan is empty");
    }

    const result = await runEvaluationPlan({
      plan,
      rules: [rule],
      provider: new FakeDecisionProvider({
        [task.id]: decisionResult("cannot_judge", 0.05),
      }),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.unknowns).toHaveLength(1);
    expect(result.metrics.unknowns).toBe(1);
  });

  test("違反と判定したunitは、選ばれたpartの範囲を指摘する", async () => {
    const rule = sampleRule({ unit: "test", violationThreshold: 0.5 });
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: `test("a", () => {
  const values = [1, 2, 3];

  expect(sum(values)).toBe(6);
});
`,
        },
      ],
      rules: [rule],
      extractor,
      matchesPath: () => true,
    });
    const task = plan.files[0]?.tasks[0];

    if (!task) {
      throw new Error("test plan is empty");
    }

    const result = await runEvaluationPlan({
      plan,
      rules: [rule],
      provider: new FakeDecisionProvider({
        [task.id]: { ...decisionResult("violation", 0.8), parts: [0.9, 0.1] },
      }),
    });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      range: { startLine: 2, endLine: 2 },
      subjectRange: { startLine: 1, endLine: 5 },
      probability: 0.8,
      partProbability: 0.9,
    });
    expect(result.evaluations[0]?.parts?.map((part) => part.probability)).toEqual(
      [0.9, 0.1],
    );
  });

  test("指摘位置を宣言したunitは違反箇所を問わず、その位置を指摘する", async () => {
    const rule = sampleRule({ unit: "variable", violationThreshold: 0.5 });
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.ts",
          source: "const hoge = getUser(), users = getUsers();\n",
        },
      ],
      rules: [rule],
      extractor,
      matchesPath: () => true,
    });
    const [hoge, users] = plan.files[0]?.tasks ?? [];

    if (!hoge || !users) {
      throw new Error("test plan is empty");
    }

    const provider = new FakeDecisionProvider({
      [hoge.id]: decisionResult("violation", 0.8),
      [users.id]: decisionResult("no_violation", 0.1),
    });
    const result = await runEvaluationPlan({ plan, rules: [rule], provider });

    expect(provider.requests).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 11 },
      subjectRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 23 },
      symbol: "hoge",
    });
    expect(result.diagnostics[0]?.partProbability).toBeUndefined();
  });
});


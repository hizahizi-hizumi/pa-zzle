import { describe, expect, test } from "bun:test";

import { runEvaluationPlan } from "./run.ts";
import { ScopeRegistry } from "../scopes/registry.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import { FakeDecisionProvider } from "../testing/fake-provider.ts";
import { decisionResult, sampleRule } from "../testing/fixtures.ts";

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
      scopes: new ScopeRegistry(),
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

    expect(provider.requests).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      ruleId: "vitest/sample",
      path: "frontend/example.test.ts",
      probability: 0.95,
      severity: "warning",
    });
    expect(result.metrics.plannedEvaluations).toBe(1);
    expect(result.metrics.providerDecisions).toBe(1);
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
      scopes: new ScopeRegistry(),
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

  test("insufficient_contextをunknownとして保持する", async () => {
    const rule = sampleRule();
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: "const value = 1;\n",
        },
      ],
      rules: [rule],
      scopes: new ScopeRegistry(),
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
        [task.id]: decisionResult("insufficient_context", 0.05),
      }),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.unknowns).toHaveLength(1);
    expect(result.metrics.unknowns).toBe(1);
  });
});

import { describe, expect, test } from "bun:test";

import type { SourceDocument } from "../domain/model.ts";
import { ScopeRegistry, subjectId } from "../scopes/registry.ts";
import { sampleRule } from "../testing/fixtures.ts";
import { buildEvaluationPlan } from "./planner.ts";

describe("buildEvaluationPlan", () => {
  test("active ruleだけを自然なsubject単位へ展開する", () => {
    const document: SourceDocument = {
      path: "frontend/example.test.ts",
      source: "test('a', () => {});\ntest('b', () => {});\n",
    };
    const scopes = new ScopeRegistry();
    scopes.register("vitest.test", (sourceDocument) => [
      {
        id: subjectId("vitest.test", sourceDocument.path, 0),
        scope: "vitest.test",
        path: sourceDocument.path,
        range: {
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 21,
        },
        symbol: 'test("a")',
        source: "test('a', () => {});",
      },
      {
        id: subjectId("vitest.test", sourceDocument.path, 1),
        scope: "vitest.test",
        path: sourceDocument.path,
        range: {
          startLine: 2,
          startColumn: 1,
          endLine: 2,
          endColumn: 21,
        },
        symbol: 'test("b")',
        source: "test('b', () => {});",
      },
    ]);

    const plan = buildEvaluationPlan({
      documents: [document],
      rules: [
        sampleRule({
          id: "vitest/active",
          scope: "vitest.test",
          status: "active",
        }),
        sampleRule({
          id: "vitest/draft",
          scope: "vitest.test",
          status: "draft",
        }),
      ],
      scopes,
      matchesPath: () => true,
    });

    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]?.subjects).toHaveLength(2);
    expect(plan.files[0]?.tasks.map((task) => task.ruleId)).toEqual([
      "vitest/active",
      "vitest/active",
    ]);
  });

  test("includeDraftでdraft ruleを明示実行できる", () => {
    const scopes = new ScopeRegistry();
    const plan = buildEvaluationPlan({
      documents: [
        {
          path: "frontend/example.test.ts",
          source: "const value = 1;\n",
        },
      ],
      rules: [
        sampleRule({
          id: "vitest/draft",
          status: "draft",
        }),
      ],
      scopes,
      matchesPath: () => true,
      includeDraft: true,
    });

    expect(plan.files[0]?.tasks).toHaveLength(1);
    expect(plan.files[0]?.tasks[0]?.ruleId).toBe("vitest/draft");
  });
});

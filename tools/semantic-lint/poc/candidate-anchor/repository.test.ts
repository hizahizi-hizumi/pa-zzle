import { describe, expect, test } from "bun:test";

import type { Rule } from "../../domain/model.ts";
import type { BenchmarkRule } from "./benchmark.ts";
import { findProjectRule } from "./repository.ts";

describe("findProjectRule", () => {
  test("ruleset prefix付きのproject ruleをbenchmark ruleへ対応付ける", () => {
    const benchmarkRule = sampleBenchmarkRule("arrange-outside-test");
    const projectRules = [
      sampleProjectRule("vitest/table-driven-cases"),
      sampleProjectRule("vitest/arrange-outside-test"),
    ];

    const result = findProjectRule(benchmarkRule, projectRules);

    expect(result?.id).toBe("vitest/arrange-outside-test");
  });

  test("対応するproject ruleがなければundefinedを返す", () => {
    const result = findProjectRule(
      sampleBenchmarkRule("meaningful-variable-name"),
      [sampleProjectRule("vitest/arrange-outside-test")],
    );

    expect(result).toBeUndefined();
  });
});

function sampleBenchmarkRule(id: string): BenchmarkRule {
  return {
    id,
    title: id,
    violationThreshold: 0.9,
    predicate: {
      instruction: "判定する",
      outcomes: {
        violation: "違反",
        compliant: "適合",
        not_applicable: "対象外",
        insufficient_context: "文脈不足",
      },
    },
  };
}

function sampleProjectRule(id: string): Rule {
  return {
    id,
    rulesetId: "vitest",
    title: id,
    status: "active",
    severity: "warning",
    violationThreshold: 0.9,
    scope: "vitest.test",
    paths: ["frontend/**/*.test.ts"],
    source: {
      path: ".claude/rules/vitest.md",
      section: "テスト構造",
    },
    predicate: {
      instruction: "判定する",
      outcomes: {
        violation: "違反",
        compliant: "適合",
        not_applicable: "対象外",
        insufficient_context: "文脈不足",
      },
    },
  };
}

import type {
  Decision,
  DecisionResult,
  Rule,
} from "../domain/model.ts";

export function decisionResult(
  decision: Decision,
  violationProbability: number,
): DecisionResult {
  const remaining = 1 - violationProbability;

  return {
    decision,
    confidence: Math.max(violationProbability, remaining),
    probabilities: {
      violation: violationProbability,
      compliant: decision === "compliant" ? remaining : 0,
      not_applicable: decision === "not_applicable" ? remaining : 0,
      insufficient_context:
        decision === "insufficient_context" ? remaining : 0,
    },
  };
}

export function sampleRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "vitest/sample",
    rulesetId: "vitest",
    title: "sample",
    status: "active",
    severity: "warning",
    violationThreshold: 0.9,
    scope: "file",
    paths: ["frontend/**/*.test.ts"],
    source: {
      path: ".claude/rules/vitest.md",
      section: "テスト構造",
    },
    predicate: {
      instruction: "Classify the subject.",
      outcomes: {
        violation: "violates",
        compliant: "complies",
        not_applicable: "not applicable",
        insufficient_context: "insufficient context",
      },
    },
    ...overrides,
  };
}

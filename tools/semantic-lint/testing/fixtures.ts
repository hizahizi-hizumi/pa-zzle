import type {
  Decision,
  DecisionResult,
  Rule,
} from "../domain/model.ts";
import { UnitExtractor } from "../units/extract.ts";

export function decisionResult(
  decision: Decision,
  violationProbability: number,
): DecisionResult {
  const probabilities = {
    violation: 0,
    compliant: 0,
    not_applicable: 0,
    insufficient_context: 0,
  };
  probabilities.violation = violationProbability;

  if (decision === "violation") {
    probabilities.compliant = 1 - violationProbability;
  } else {
    probabilities[decision] = 1 - violationProbability;
  }

  return {
    decision,
    confidence: probabilities[decision],
    probabilities,
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
    unit: "file",
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

let sharedExtractor: Promise<UnitExtractor> | undefined;

/** 同梱カタログのextractor。文法の読み込みをtest間で共有する。 */
export function testExtractor(): Promise<UnitExtractor> {
  sharedExtractor ??= UnitExtractor.create();

  return sharedExtractor;
}

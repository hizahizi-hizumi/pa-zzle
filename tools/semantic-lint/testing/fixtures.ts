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
    no_violation: 0,
    cannot_judge: 0,
  };
  probabilities.violation = violationProbability;

  if (decision === "violation") {
    probabilities.no_violation = 1 - violationProbability;
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
    severity: "warning",
    violationThreshold: 0.9,
    unit: "file",
    paths: ["frontend/**/*.test.ts"],
    instruction: "The subject must satisfy the sample rule.",
    ...overrides,
  };
}

let sharedExtractor: Promise<UnitExtractor> | undefined;

/** 同梱カタログのextractor。文法の読み込みをtest間で共有する。 */
export function testExtractor(): Promise<UnitExtractor> {
  sharedExtractor ??= UnitExtractor.create();

  return sharedExtractor;
}

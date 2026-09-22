import { dirname, resolve } from "node:path";
import { YAML } from "bun";

import {
  DECISIONS,
  type Decision,
  type Predicate,
  type SourceRange,
} from "../../domain/model.ts";
import type { GoldenFindingExpectation } from "../../config/cases.ts";

export type BenchmarkRule = {
  id: string;
  title: string;
  violationThreshold: number;
  predicate: Predicate;
};

export type BenchmarkCase = {
  ruleId: string;
  name: string;
  fixturePath: string;
  expectedFindings: GoldenFindingExpectation[];
};

export type CandidateAnchorBenchmark = {
  origin: string;
  rules: BenchmarkRule[];
  cases: BenchmarkCase[];
};

export async function loadCandidateAnchorBenchmark(
  benchmarkPath: string,
): Promise<CandidateAnchorBenchmark> {
  const text = await Bun.file(benchmarkPath).text();

  return compileCandidateAnchorBenchmark(YAML.parse(text), benchmarkPath);
}

export function compileCandidateAnchorBenchmark(
  value: unknown,
  origin: string,
): CandidateAnchorBenchmark {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.rules) ||
    value.rules.length === 0 ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0
  ) {
    throw new Error(`candidate-anchor benchmarkが不正です: ${origin}`);
  }

  const rules = value.rules.map((rule, index) =>
    compileRule(rule, origin, index),
  );
  const ruleIds = new Set(rules.map((rule) => rule.id));
  const baseDirectory = dirname(origin);
  const cases = value.cases.map((item, index) =>
    compileCase(item, origin, baseDirectory, index, ruleIds),
  );

  return { origin, rules, cases };
}

function compileRule(
  value: unknown,
  origin: string,
  index: number,
): BenchmarkRule {
  if (!isRecord(value)) {
    throw new Error(`benchmark ruleが不正です: ${origin} rules[${index}]`);
  }

  const { id, title, violationThreshold, predicate } = value;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof title !== "string" ||
    !isProbability(violationThreshold) ||
    !isRecord(predicate) ||
    typeof predicate.instruction !== "string" ||
    !isRecord(predicate.outcomes)
  ) {
    throw new Error(`benchmark ruleが不正です: ${origin} rules[${index}]`);
  }

  const outcomes = Object.fromEntries(
    DECISIONS.map((decision) => {
      const description = predicate.outcomes[decision];

      if (typeof description !== "string") {
        throw new Error(
          `benchmark predicate.outcomes.${decision}が不正です: ${origin} rules[${index}]`,
        );
      }

      return [decision, description];
    }),
  ) as Record<Decision, string>;

  return {
    id,
    title,
    violationThreshold,
    predicate: {
      instruction: predicate.instruction,
      outcomes,
    },
  };
}

function compileCase(
  value: unknown,
  origin: string,
  baseDirectory: string,
  index: number,
  ruleIds: Set<string>,
): BenchmarkCase {
  if (
    !isRecord(value) ||
    typeof value.rule !== "string" ||
    !ruleIds.has(value.rule) ||
    typeof value.name !== "string" ||
    typeof value.fixture !== "string" ||
    !Array.isArray(value.expectedFindings)
  ) {
    throw new Error(`benchmark caseが不正です: ${origin} cases[${index}]`);
  }

  return {
    ruleId: value.rule,
    name: value.name,
    fixturePath: resolve(baseDirectory, value.fixture),
    expectedFindings: value.expectedFindings.map((finding, findingIndex) =>
      compileFindingExpectation(finding, origin, index, findingIndex),
    ),
  };
}

function compileFindingExpectation(
  value: unknown,
  origin: string,
  caseIndex: number,
  findingIndex: number,
): GoldenFindingExpectation {
  if (!isRecord(value)) {
    throw new Error(
      `benchmark expectedFindingが不正です: ${origin} cases[${caseIndex}] expectedFindings[${findingIndex}]`,
    );
  }

  if (typeof value.text === "string" && value.range === undefined) {
    const occurrence = value.occurrence ?? 1;

    if (!isPositiveInteger(occurrence)) {
      throw new Error(
        `benchmark occurrenceが不正です: ${origin} cases[${caseIndex}] expectedFindings[${findingIndex}]`,
      );
    }

    return { text: value.text, occurrence };
  }

  if (value.text === undefined && isSourceRange(value.range)) {
    return { range: value.range };
  }

  throw new Error(
    `benchmark expectedFindingが不正です: ${origin} cases[${caseIndex}] expectedFindings[${findingIndex}]`,
  );
}

function isSourceRange(value: unknown): value is SourceRange {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.startLine) &&
    isPositiveInteger(value.startColumn) &&
    isPositiveInteger(value.endLine) &&
    isPositiveInteger(value.endColumn)
  );
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

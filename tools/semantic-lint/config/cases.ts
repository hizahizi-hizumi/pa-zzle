import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { YAML } from "bun";

import {
  DECISIONS,
  type Decision,
  type SourceRange,
} from "../domain/model.ts";

export type GoldenFindingExpectation =
  | {
      text: string;
      occurrence: number;
    }
  | {
      range: SourceRange;
    };

export type GoldenCase = {
  rulesetId: string;
  ruleId: string;
  name: string;
  fixturePath: string;
  expected: Decision;
  expectedFindings?: GoldenFindingExpectation[];
  subjectSymbol?: string;
  origin?: {
    path: string;
    note?: string;
  };
};

export async function loadGoldenCases(
  projectRoot: string,
  casesDir: string,
): Promise<GoldenCase[]> {
  const directory = resolve(projectRoot, casesDir);
  const manifestPaths = await collectCaseManifests(directory);
  const cases: GoldenCase[] = [];

  for (const manifestPath of manifestPaths) {
    const text = await Bun.file(manifestPath).text();
    const value = YAML.parse(text);
    cases.push(...compileCaseManifest(value, manifestPath));
  }

  return cases.sort(
    (left, right) =>
      left.ruleId.localeCompare(right.ruleId) ||
      left.name.localeCompare(right.name),
  );
}

export function compileCaseManifest(
  value: unknown,
  origin: string,
): GoldenCase[] {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.ruleset !== "string" ||
    value.ruleset.length === 0 ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0
  ) {
    throw new Error(`golden case manifestが不正です: ${origin}`);
  }

  const rulesetId = value.ruleset;
  const baseDirectory = dirname(origin);

  return value.cases.map((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.rule !== "string" ||
      typeof item.name !== "string" ||
      typeof item.fixture !== "string" ||
      !isDecision(item.expected)
    ) {
      throw new Error(
        `golden caseが不正です: ${origin} cases[${index}]`,
      );
    }

    const subjectSymbol = compileSubjectSymbol(item.subject, origin, index);
    const expectedFindings = compileExpectedFindings(
      item.expectedFindings,
      origin,
      index,
    );
    const goldenCase: GoldenCase = {
      rulesetId,
      ruleId: `${rulesetId}/${item.rule}`,
      name: item.name,
      fixturePath: resolve(baseDirectory, item.fixture),
      expected: item.expected,
    };

    if (expectedFindings !== undefined) {
      goldenCase.expectedFindings = expectedFindings;
    }

    if (subjectSymbol !== undefined) {
      goldenCase.subjectSymbol = subjectSymbol;
    }

    if (item.origin !== undefined) {
      if (
        !isRecord(item.origin) ||
        typeof item.origin.path !== "string" ||
        (item.origin.note !== undefined &&
          typeof item.origin.note !== "string")
      ) {
        throw new Error(
          `golden case originが不正です: ${origin} cases[${index}]`,
        );
      }

      goldenCase.origin = {
        path: item.origin.path,
        ...(item.origin.note === undefined
          ? {}
          : { note: item.origin.note }),
      };
    }

    return goldenCase;
  });
}

async function collectCaseManifests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectCaseManifests(path)));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name === "cases.yaml" || entry.name === "cases.yml")
    ) {
      paths.push(path);
    }
  }

  return paths.sort();
}

function compileExpectedFindings(
  value: unknown,
  origin: string,
  index: number,
): GoldenFindingExpectation[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `golden case expectedFindingsが不正です: ${origin} cases[${index}]`,
    );
  }

  return value.map((item, findingIndex) => {
    if (!isRecord(item)) {
      throw new Error(
        `golden case expectedFindingsが不正です: ${origin} cases[${index}] expectedFindings[${findingIndex}]`,
      );
    }

    const hasText = item.text !== undefined;
    const hasRange = item.range !== undefined;

    if (hasText === hasRange) {
      throw new Error(
        `golden case expectedFindingsはtextまたはrangeのどちらか一方を指定してください: ${origin} cases[${index}] expectedFindings[${findingIndex}]`,
      );
    }

    if (hasText) {
      if (typeof item.text !== "string" || item.text.length === 0) {
        throw new Error(
          `golden case expectedFindings.textが不正です: ${origin} cases[${index}] expectedFindings[${findingIndex}]`,
        );
      }

      const occurrence = item.occurrence ?? 1;

      if (!isPositiveInteger(occurrence)) {
        throw new Error(
          `golden case expectedFindings.occurrenceが不正です: ${origin} cases[${index}] expectedFindings[${findingIndex}]`,
        );
      }

      return {
        text: item.text,
        occurrence,
      };
    }

    if (isSourceRange(item.range)) {
      return { range: item.range };
    }

    throw new Error(
      `golden case expectedFindings.rangeが不正です: ${origin} cases[${index}] expectedFindings[${findingIndex}]`,
    );
  });
}

function compileSubjectSymbol(
  value: unknown,
  origin: string,
  index: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || typeof value.symbol !== "string") {
    throw new Error(
      `golden case subjectが不正です: ${origin} cases[${index}]`,
    );
  }

  return value.symbol;
}

function isDecision(value: unknown): value is Decision {
  return (
    typeof value === "string" &&
    DECISIONS.includes(value as Decision)
  );
}

function isSourceRange(value: unknown): value is SourceRange {
  if (!isRecord(value)) {
    return false;
  }

  const { startLine, startColumn, endLine, endColumn } = value;

  if (
    !isPositiveInteger(startLine) ||
    !isPositiveInteger(startColumn) ||
    !isPositiveInteger(endLine) ||
    !isPositiveInteger(endColumn)
  ) {
    return false;
  }

  return (
    endLine > startLine ||
    (endLine === startLine && endColumn >= startColumn)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

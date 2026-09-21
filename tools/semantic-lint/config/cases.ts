import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { YAML } from "bun";

import {
  DECISIONS,
  type Decision,
} from "../domain/model.ts";

export type GoldenCase = {
  rulesetId: string;
  ruleId: string;
  name: string;
  fixturePath: string;
  expected: Decision;
  subjectSymbol?: string;
  subjectSource?: string;
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

    const subjectSelector = compileSubjectSelector(item.subject, origin, index);
    const goldenCase: GoldenCase = {
      rulesetId,
      ruleId: `${rulesetId}/${item.rule}`,
      name: item.name,
      fixturePath: resolve(baseDirectory, item.fixture),
      expected: item.expected,
    };

    if (subjectSelector?.symbol !== undefined) {
      goldenCase.subjectSymbol = subjectSelector.symbol;
    }

    if (subjectSelector?.source !== undefined) {
      goldenCase.subjectSource = subjectSelector.source;
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

function compileSubjectSelector(
  value: unknown,
  origin: string,
  index: number,
): { symbol?: string; source?: string } | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(
      `golden case subjectが不正です: ${origin} cases[${index}]`,
    );
  }

  const symbol = value.symbol;
  const source = value.source;

  if (
    (symbol !== undefined && typeof symbol !== "string") ||
    (source !== undefined && typeof source !== "string") ||
    (symbol === undefined && source === undefined)
  ) {
    throw new Error(
      `golden case subjectが不正です: ${origin} cases[${index}]`,
    );
  }

  return {
    ...(typeof symbol === "string" ? { symbol } : {}),
    ...(typeof source === "string" ? { source } : {}),
  };
}

function isDecision(value: unknown): value is Decision {
  return (
    typeof value === "string" &&
    DECISIONS.includes(value as Decision)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

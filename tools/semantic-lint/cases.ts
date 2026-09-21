import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import {
  DECISION_CHOICES,
  type DecisionChoice,
  type RuleConfig,
} from "./types.ts";

export type CalibrationCase = {
  name: string;
  path: string;
  source: string;
  expected: DecisionChoice;
  rule: RuleConfig;
};

type CaseManifest = {
  version: 1;
  ruleset: string;
  cases: Array<{
    rule: string;
    name?: string;
    file: string;
    expected: DecisionChoice;
  }>;
};

export async function loadCalibrationCases(
  projectRoot: string,
  casesDir: string,
  rules: RuleConfig[],
): Promise<CalibrationCase[]> {
  const directory = resolve(projectRoot, casesDir);
  const manifestPaths = await collectCaseManifests(directory);
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const cases: CalibrationCase[] = [];

  for (const manifestPath of manifestPaths) {
    const value: unknown = await Bun.file(manifestPath).json();
    const manifest = parseManifest(value, manifestPath);

    for (const definition of manifest.cases) {
      const ruleId = manifest.ruleset + "/" + definition.rule;
      const rule = rulesById.get(ruleId);

      if (!rule) {
        throw new Error(
          "caseが存在しないruleを参照しています: " + ruleId,
        );
      }

      const absolutePath = resolve(dirname(manifestPath), definition.file);

      if (!isPathWithin(directory, absolutePath)) {
        throw new Error(
          "case fileはcasesDir内に置いてください: " + definition.file,
        );
      }

      const file = Bun.file(absolutePath);

      if (!(await file.exists())) {
        throw new Error("case fileが存在しません: " + definition.file);
      }

      cases.push({
        name: definition.name ?? definition.file,
        path: relative(projectRoot, absolutePath).split(sep).join("/"),
        source: await file.text(),
        expected: definition.expected,
        rule,
      });
    }
  }

  return cases.sort(
    (left, right) =>
      left.rule.id.localeCompare(right.rule.id) ||
      left.name.localeCompare(right.name),
  );
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

    if (entry.isFile() && entry.name === "cases.json") {
      paths.push(path);
    }
  }

  return paths.sort();
}

function parseManifest(value: unknown, path: string): CaseManifest {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.ruleset !== "string" ||
    value.ruleset.length === 0 ||
    value.ruleset.includes("/") ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0
  ) {
    throw new Error("case manifestが不正です: " + path);
  }

  const cases = value.cases.map((definition, index) => {
    if (
      !isRecord(definition) ||
      typeof definition.rule !== "string" ||
      definition.rule.length === 0 ||
      definition.rule.includes("/") ||
      (definition.name !== undefined && typeof definition.name !== "string") ||
      typeof definition.file !== "string" ||
      !isDecisionChoice(definition.expected)
    ) {
      throw new Error(
        "case manifestが不正です: " + path + " cases[" + index + "]",
      );
    }

    return {
      rule: definition.rule,
      name: definition.name as string | undefined,
      file: definition.file,
      expected: definition.expected,
    };
  });

  return {
    version: 1,
    ruleset: value.ruleset,
    cases,
  };
}

function isDecisionChoice(value: unknown): value is DecisionChoice {
  return (
    typeof value === "string" &&
    DECISION_CHOICES.includes(value as DecisionChoice)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPathWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);

  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(".." + sep) &&
      !isAbsolute(pathFromParent))
  );
}

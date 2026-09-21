import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DECISION_CHOICES,
  type DecisionChoice,
  type LintConfig,
  type RuleConfig,
  type Severity,
} from "./types.ts";

export async function loadLintConfig(projectRoot: string): Promise<LintConfig> {
  const path = resolve(projectRoot, ".semantic-lint/config.json");
  const value: unknown = await Bun.file(path).json();

  if (!isRecord(value) || value.version !== 1) {
    throw new Error("semantic lint設定のversionが不正です。");
  }

  const provider = value.provider;

  if (
    !isRecord(provider) ||
    provider.kind !== "typesafe" ||
    typeof provider.model !== "string" ||
    typeof provider.apiKeyEnv !== "string"
  ) {
    throw new Error("provider設定が不正です。");
  }

  if (
    typeof value.rulesDir !== "string" ||
    typeof value.casesDir !== "string" ||
    typeof value.concurrency !== "number" ||
    !Number.isInteger(value.concurrency) ||
    value.concurrency < 1
  ) {
    throw new Error("semantic lint設定が不正です。");
  }

  return {
    version: 1,
    provider: {
      kind: "typesafe",
      model: provider.model,
      apiKeyEnv: provider.apiKeyEnv,
    },
    rulesDir: value.rulesDir,
    casesDir: value.casesDir,
    concurrency: value.concurrency,
  };
}

export async function loadRules(
  projectRoot: string,
  rulesDir: string,
): Promise<RuleConfig[]> {
  const directory = resolve(projectRoot, rulesDir);
  const paths = await collectJsonFiles(directory);
  const rules: RuleConfig[] = [];

  for (const path of paths) {
    const raw: unknown = await Bun.file(path).json();
    rules.push(parseRule(raw, path));
  }

  const ids = new Set<string>();

  for (const rule of rules) {
    if (ids.has(rule.id)) {
      throw new Error(`rule idが重複しています: ${rule.id}`);
    }

    ids.add(rule.id);
  }

  return rules.sort((left, right) => left.id.localeCompare(right.id));
}

function parseRule(value: unknown, path: string): RuleConfig {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error(`ruleのversionが不正です: ${path}`);
  }

  const {
    id,
    title,
    target,
    severity,
    violationThreshold,
    include,
    exclude,
    source,
    question,
  } = value;

  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    target !== "file" ||
    !isSeverity(severity) ||
    typeof violationThreshold !== "number" ||
    violationThreshold < 0 ||
    violationThreshold > 1 ||
    !isStringArray(include) ||
    include.length === 0 ||
    !isStringArray(exclude)
  ) {
    throw new Error(`ruleの基本設定が不正です: ${path}`);
  }

  if (
    !isRecord(source) ||
    typeof source.path !== "string" ||
    typeof source.section !== "string"
  ) {
    throw new Error(`ruleのsourceが不正です: ${path}`);
  }

  if (
    !isRecord(question) ||
    typeof question.instructions !== "string" ||
    !isRecord(question.criteria)
  ) {
    throw new Error(`ruleのquestionが不正です: ${path}`);
  }

  const criteriaRecord = question.criteria;
  const criteria = Object.fromEntries(
    DECISION_CHOICES.map((choice) => {
      const description = criteriaRecord[choice];

      if (typeof description !== "string") {
        throw new Error(`criteria.${choice} がありません: ${path}`);
      }

      return [choice, description];
    }),
  ) as Record<DecisionChoice, string>;

  return {
    version: 1,
    id,
    title,
    target,
    severity,
    violationThreshold,
    include,
    exclude,
    source: {
      path: source.path,
      section: source.section,
    },
    question: {
      instructions: question.instructions,
      criteria,
    },
  };
}

async function collectJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectJsonFiles(path)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      paths.push(path);
    }
  }

  return paths.sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSeverity(value: unknown): value is Severity {
  return value === "warning" || value === "error";
}

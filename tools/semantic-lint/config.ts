import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DECISION_CHOICES,
  RULE_SCOPES,
  type DecisionChoice,
  type LintConfig,
  type RuleConfig,
  type RuleScope,
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
  const rules = (
    await Promise.all(
      paths.map(async (path) => {
        const raw: unknown = await Bun.file(path).json();
        return parseRuleSet(raw, path);
      }),
    )
  ).flat();

  const ids = new Set<string>();

  for (const rule of rules) {
    if (ids.has(rule.id)) {
      throw new Error(`rule idが重複しています: ${rule.id}`);
    }

    ids.add(rule.id);
  }

  return rules.sort((left, right) => left.id.localeCompare(right.id));
}

function parseRuleSet(value: unknown, path: string): RuleConfig[] {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error(`rulesetのversionが不正です: ${path}`);
  }

  const { id, paths, excludePaths, source, defaults, rules } = value;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.includes("/") ||
    !isStringArray(paths) ||
    paths.length === 0 ||
    (excludePaths !== undefined && !isStringArray(excludePaths)) ||
    typeof source !== "string" ||
    !isRecord(defaults) ||
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    throw new Error(`rulesetの基本設定が不正です: ${path}`);
  }

  const defaultSeverity = defaults.severity;
  const defaultViolationThreshold = defaults.violationThreshold;

  if (
    !isSeverity(defaultSeverity) ||
    !isProbability(defaultViolationThreshold)
  ) {
    throw new Error(`rulesetのdefaultsが不正です: ${path}`);
  }

  const parsedRules = rules.map((rule, index) =>
    parseRule({
      value: rule,
      path,
      index,
      rulesetId: id,
      paths,
      excludePaths: excludePaths ?? [],
      source,
      defaults: {
        severity: defaultSeverity,
        violationThreshold: defaultViolationThreshold,
      },
    }),
  );

  const localIds = new Set<string>();

  for (const rule of parsedRules) {
    const localId = rule.id.slice(id.length + 1);

    if (localIds.has(localId)) {
      throw new Error(`ruleset内でrule idが重複しています: ${rule.id}`);
    }

    localIds.add(localId);
  }

  return parsedRules;
}

function parseRule(options: {
  value: unknown;
  path: string;
  index: number;
  rulesetId: string;
  paths: string[];
  excludePaths: string[];
  source: string;
  defaults: {
    severity: Severity;
    violationThreshold: number;
  };
}): RuleConfig {
  const {
    value,
    path,
    index,
    rulesetId,
    paths,
    excludePaths,
    source,
    defaults,
  } = options;

  if (!isRecord(value)) {
    throw new Error(`ruleが不正です: ${path} rules[${index}]`);
  }

  const {
    id,
    title,
    scope,
    sourceSection,
    severity: rawSeverity,
    violationThreshold: rawViolationThreshold,
    question,
  } = value;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.includes("/") ||
    typeof title !== "string" ||
    !isRuleScope(scope) ||
    typeof sourceSection !== "string" ||
    (rawSeverity !== undefined && !isSeverity(rawSeverity)) ||
    (rawViolationThreshold !== undefined &&
      !isProbability(rawViolationThreshold)) ||
    !isRecord(question) ||
    typeof question.instructions !== "string" ||
    !isRecord(question.criteria)
  ) {
    throw new Error(`ruleの設定が不正です: ${path} rules[${index}]`);
  }

  const criteriaRecord = question.criteria;
  const criteria = Object.fromEntries(
    DECISION_CHOICES.map((choice) => {
      const description = criteriaRecord[choice];

      if (typeof description !== "string") {
        throw new Error(
          `criteria.${choice} がありません: ${path} rules[${index}]`,
        );
      }

      return [choice, description];
    }),
  ) as Record<DecisionChoice, string>;

  return {
    id: `${rulesetId}/${id}`,
    title,
    scope,
    severity: rawSeverity ?? defaults.severity,
    violationThreshold:
      rawViolationThreshold ?? defaults.violationThreshold,
    paths,
    excludePaths,
    source: {
      path: source,
      section: sourceSection,
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

function isProbability(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRuleScope(value: unknown): value is RuleScope {
  return (
    typeof value === "string" &&
    RULE_SCOPES.includes(value as RuleScope)
  );
}

function isSeverity(value: unknown): value is Severity {
  return value === "warning" || value === "error";
}

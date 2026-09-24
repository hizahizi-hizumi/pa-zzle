import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { YAML } from "bun";

import {
  DECISIONS,
  RULE_STATUSES,
  SEVERITIES,
  type Decision,
  type Rule,
  type RuleStatus,
  type Severity,
} from "../domain/model.ts";

type RuleDefaults = {
  status: RuleStatus;
  severity: Severity;
  violationThreshold: number;
};

export function compileRuleset(value: unknown, origin: string): Rule[] {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error(`rulesetのversionが不正です: ${origin}`);
  }

  const { id, paths, source, defaults, rules } = value;

  if (
    !isId(id) ||
    !isStringArray(paths) ||
    paths.length === 0 ||
    !isRecord(source) ||
    !isRecord(defaults) ||
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    throw new Error(`rulesetの基本設定が不正です: ${origin}`);
  }

  const sourcePath = source.path;

  if (typeof sourcePath !== "string") {
    throw new Error(`ruleset sourceが不正です: ${origin}`);
  }

  const compiledDefaults = compileDefaults(defaults, origin);
  const compiled = rules.map((rule, index) =>
    compileRule({
      value: rule,
      origin,
      index,
      rulesetId: id,
      paths,
      sourcePath,
      defaults: compiledDefaults,
    }),
  );

  const ids = new Set<string>();

  for (const rule of compiled) {
    if (ids.has(rule.id)) {
      throw new Error(`rule idが重複しています: ${rule.id}`);
    }

    ids.add(rule.id);
  }

  return compiled;
}

export async function loadRulesets(
  projectRoot: string,
  rulesDir: string,
): Promise<Rule[]> {
  const directory = resolve(projectRoot, rulesDir);
  const paths = await collectYamlFiles(directory);
  const rules = (
    await Promise.all(
      paths.map(async (path) => {
        const text = await Bun.file(path).text();
        const parsed = YAML.parse(text);
        return compileRuleset(parsed, path);
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

function compileDefaults(value: Record<string, unknown>, origin: string): RuleDefaults {
  const { status, severity, violationThreshold } = value;

  if (
    !isRuleStatus(status) ||
    !isSeverity(severity) ||
    !isProbability(violationThreshold)
  ) {
    throw new Error(`ruleset defaultsが不正です: ${origin}`);
  }

  return { status, severity, violationThreshold };
}

function compileRule(options: {
  value: unknown;
  origin: string;
  index: number;
  rulesetId: string;
  paths: string[];
  sourcePath: string;
  defaults: RuleDefaults;
}): Rule {
  const {
    value,
    origin,
    index,
    rulesetId,
    paths,
    sourcePath,
    defaults,
  } = options;

  if (!isRecord(value)) {
    throw new Error(`ruleが不正です: ${origin} rules[${index}]`);
  }

  const {
    id,
    title,
    status,
    severity,
    violationThreshold,
    scope,
    unit,
    sourceSection,
    predicate,
  } = value;

  const target = compileTarget(scope, unit, `${origin} rules[${index}]`);

  if (
    !isId(id) ||
    typeof title !== "string" ||
    typeof sourceSection !== "string" ||
    !isRecord(predicate) ||
    typeof predicate.instruction !== "string" ||
    !isRecord(predicate.outcomes)
  ) {
    throw new Error(`rule設定が不正です: ${origin} rules[${index}]`);
  }

  const compiledStatus = status ?? defaults.status;
  const compiledSeverity = severity ?? defaults.severity;
  const compiledViolationThreshold =
    violationThreshold ?? defaults.violationThreshold;

  if (
    !isRuleStatus(compiledStatus) ||
    !isSeverity(compiledSeverity) ||
    !isProbability(compiledViolationThreshold)
  ) {
    throw new Error(`rule policyが不正です: ${origin} rules[${index}]`);
  }

  const outcomesRecord = predicate.outcomes;

  if (!isRecord(outcomesRecord)) {
    throw new Error(`predicate.outcomesが不正です: ${origin} rules[${index}]`);
  }

  const outcomes = Object.fromEntries(
    DECISIONS.map((decision) => {
      const description = outcomesRecord[decision];

      if (typeof description !== "string") {
        throw new Error(
          `predicate.outcomes.${decision} がありません: ${origin} rules[${index}]`,
        );
      }

      return [decision, description];
    }),
  ) as Record<Decision, string>;

  return {
    id: `${rulesetId}/${id}`,
    rulesetId,
    title,
    status: compiledStatus,
    severity: compiledSeverity,
    violationThreshold: compiledViolationThreshold,
    ...target,
    paths,
    source: {
      path: sourcePath,
      section: sourceSection,
    },
    predicate: {
      instruction: predicate.instruction,
      outcomes,
    },
  };
}

/** scopeとunitはどちらか一方だけを指定する。 */
function compileTarget(
  scope: unknown,
  unit: unknown,
  location: string,
): { scope: string } | { unit: string } {
  if (scope !== undefined && unit !== undefined) {
    throw new Error(`scopeとunitは同時に指定できません: ${location}`);
  }

  if (typeof scope === "string" && scope.length > 0) {
    return { scope };
  }

  if (typeof unit === "string" && unit.length > 0) {
    return { unit };
  }

  throw new Error(`ruleにはscopeまたはunitが必要です: ${location}`);
}

async function collectYamlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectYamlFiles(path)));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))
    ) {
      paths.push(path);
    }
  }

  return paths.sort();
}

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("/") &&
    /^[a-z0-9][a-z0-9-]*$/.test(value)
  );
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

function isRuleStatus(value: unknown): value is RuleStatus {
  return (
    typeof value === "string" &&
    RULE_STATUSES.includes(value as RuleStatus)
  );
}

function isSeverity(value: unknown): value is Severity {
  return (
    typeof value === "string" &&
    SEVERITIES.includes(value as Severity)
  );
}

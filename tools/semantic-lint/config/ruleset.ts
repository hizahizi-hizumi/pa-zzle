import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { YAML } from "bun";

import { SEVERITIES, type Rule, type Severity } from "../domain/model.ts";

/** rulesetに書けるkey。 */
const RULESET_KEYS = new Set(["version", "id", "paths", "exclude", "rules"]);

/**
 * rule作者が書けるkey。scope・selector・contextなどの抽出方法はunitカタログが持ち、
 * 判定の選択肢（違反 / 違反ではない / 判断できない）とその説明はエンジンが持つ。
 */
const RULE_KEYS = new Set([
  "id",
  "title",
  "unit",
  "severity",
  "violationThreshold",
  "instruction",
]);

/**
 * rulesetを検証してruleへ展開する。
 * `units` はunitカタログの語彙で、ruleの `unit` はこの中から選ぶ。
 */
export function compileRuleset(
  value: unknown,
  origin: string,
  units: ReadonlySet<string>,
): Rule[] {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error(`rulesetのversionが不正です: ${origin}`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !RULESET_KEYS.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(
      `rulesetに書けないkeyがあります: ${unknownKeys.join(", ")} (${origin})`,
    );
  }

  const { id, paths, exclude = [], rules } = value;

  if (
    !isId(id) ||
    !isStringArray(paths) ||
    paths.length === 0 ||
    !isStringArray(exclude) ||
    !Array.isArray(rules) ||
    rules.length === 0
  ) {
    throw new Error(`rulesetの基本設定が不正です: ${origin}`);
  }

  const compiled = rules.map((rule, index) =>
    compileRule({
      value: rule,
      origin,
      index,
      rulesetId: id,
      paths,
      exclude,
      units,
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
  units: ReadonlySet<string>,
): Promise<Rule[]> {
  const directory = resolve(projectRoot, rulesDir);
  const paths = await collectYamlFiles(directory);
  const rules = (
    await Promise.all(
      paths.map(async (path) => {
        const text = await Bun.file(path).text();
        const parsed = YAML.parse(text);
        return compileRuleset(parsed, path, units);
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

function compileRule(options: {
  value: unknown;
  origin: string;
  index: number;
  rulesetId: string;
  paths: string[];
  exclude: string[];
  units: ReadonlySet<string>;
}): Rule {
  const { value, origin, index, rulesetId, paths, exclude, units } = options;

  if (!isRecord(value)) {
    throw new Error(`ruleが不正です: ${origin} rules[${index}]`);
  }

  const unknownKeys = Object.keys(value).filter((key) => !RULE_KEYS.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(
      `ruleに書けないkeyがあります: ${unknownKeys.join(", ")} (${origin} rules[${index}])。書けるkeyは ${[...RULE_KEYS].join(" / ")} です。`,
    );
  }

  const {
    id,
    title,
    severity = "warning",
    violationThreshold,
    unit,
    instruction,
  } = value;

  if (typeof unit !== "string" || !units.has(unit)) {
    throw new Error(
      `ruleのunitが未知です: ${String(unit)} (${origin} rules[${index}])。使えるunit: ${[...units].sort().join(", ")}`,
    );
  }

  if (
    !isId(id) ||
    typeof title !== "string" ||
    typeof instruction !== "string" ||
    instruction.trim().length === 0
  ) {
    throw new Error(`rule設定が不正です: ${origin} rules[${index}]`);
  }

  if (!isSeverity(severity)) {
    throw new Error(
      `severityにはinfo / warning / errorを指定してください: ${origin} rules[${index}]`,
    );
  }

  if (!isProbability(violationThreshold)) {
    throw new Error(
      `violationThresholdには0〜1の数値を指定してください: ${origin} rules[${index}]`,
    );
  }

  return {
    id: `${rulesetId}/${id}`,
    rulesetId,
    title,
    severity,
    violationThreshold,
    unit,
    paths,
    exclude,
    instruction,
  };
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

function isSeverity(value: unknown): value is Severity {
  return (
    typeof value === "string" && SEVERITIES.includes(value as Severity)
  );
}

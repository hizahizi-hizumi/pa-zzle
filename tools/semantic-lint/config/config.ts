import { resolve } from "node:path";
import { YAML } from "bun";

import type { RequestTokenBudget } from "../domain/model.ts";

const DEFAULT_GOLDEN_DIR = ".semantic-lint/golden";

/** Jevのrequest上限（state + 質問1つで32k、request全体で64k）。 */
export const DEFAULT_REQUEST_TOKEN_BUDGET: RequestTokenBudget = {
  stateAndQuestion: 32_000,
  total: 64_000,
};

export type SemanticLintConfig = {
  version: 1;
  rulesDir: string;
  /**
   * 評価専用のruleset。`bench` と `doctor` だけが読み、`check` / `inspect` では実行しない。
   * 人間向け規約に正本がなく本番rulesetへ入れない、判定方式の評価用のruleを置く。
   */
  evalRulesDir?: string;
  goldenDir: string;
  excludePaths: string[];
  execution: {
    concurrency: number;
    requestTokenBudget: RequestTokenBudget;
  };
  provider: {
    kind: "typesafe";
    model: string;
    apiKeyEnv: string;
  };
};

export function compileConfig(
  value: unknown,
  origin = ".semantic-lint/config.yaml",
): SemanticLintConfig {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error(`semantic lint configのversionが不正です: ${origin}`);
  }

  const rulesDir = value.rulesDir;
  const evalRulesDir = value.evalRulesDir;
  const goldenDir = value.goldenDir ?? DEFAULT_GOLDEN_DIR;
  const excludePaths = value.excludePaths;
  const execution = value.execution;
  const provider = value.provider;

  if (
    typeof rulesDir !== "string" ||
    (evalRulesDir !== undefined && typeof evalRulesDir !== "string") ||
    typeof goldenDir !== "string" ||
    !isStringArray(excludePaths) ||
    !isRecord(execution) ||
    !isRecord(provider)
  ) {
    throw new Error(`semantic lint configが不正です: ${origin}`);
  }

  if (execution.maxDecisionsPerRequest !== undefined) {
    throw new Error(
      `execution.maxDecisionsPerRequestは廃止しました。requestはexecution.requestTokenBudgetで分割します: ${origin}`,
    );
  }

  const concurrency = execution.concurrency;
  const requestTokenBudget = compileRequestTokenBudget(
    execution.requestTokenBudget,
    origin,
  );
  const providerKind = provider.kind;
  const model = provider.model;
  const apiKeyEnv = provider.apiKeyEnv;

  if (
    !isPositiveInteger(concurrency) ||
    providerKind !== "typesafe" ||
    typeof model !== "string" ||
    typeof apiKeyEnv !== "string"
  ) {
    throw new Error(`semantic lint configが不正です: ${origin}`);
  }

  return {
    version: 1,
    rulesDir,
    ...(evalRulesDir === undefined ? {} : { evalRulesDir }),
    goldenDir,
    excludePaths,
    execution: {
      concurrency,
      requestTokenBudget,
    },
    provider: {
      kind: providerKind,
      model,
      apiKeyEnv,
    },
  };
}

export async function loadSemanticLintConfig(
  projectRoot: string,
): Promise<SemanticLintConfig> {
  const path = resolve(projectRoot, ".semantic-lint/config.yaml");
  const text = await Bun.file(path).text();

  return compileConfig(YAML.parse(text), path);
}

function compileRequestTokenBudget(
  value: unknown,
  origin: string,
): RequestTokenBudget {
  if (value === undefined) {
    return DEFAULT_REQUEST_TOKEN_BUDGET;
  }

  if (
    !isRecord(value) ||
    !isPositiveInteger(value.stateAndQuestion) ||
    !isPositiveInteger(value.total) ||
    value.stateAndQuestion > value.total
  ) {
    throw new Error(`execution.requestTokenBudgetが不正です: ${origin}`);
  }

  return {
    stateAndQuestion: value.stateAndQuestion,
    total: value.total,
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

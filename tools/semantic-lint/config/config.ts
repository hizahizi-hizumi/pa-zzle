import { resolve } from "node:path";
import { YAML } from "bun";

export type SemanticLintConfig = {
  version: 1;
  rulesDir: string;
  casesDir: string;
  excludePaths: string[];
  execution: {
    concurrency: number;
    maxDecisionsPerRequest: number;
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
  const casesDir = value.casesDir;
  const excludePaths = value.excludePaths;
  const execution = value.execution;
  const provider = value.provider;

  if (
    typeof rulesDir !== "string" ||
    typeof casesDir !== "string" ||
    !isStringArray(excludePaths) ||
    !isRecord(execution) ||
    !isRecord(provider)
  ) {
    throw new Error(`semantic lint configが不正です: ${origin}`);
  }

  const concurrency = execution.concurrency;
  const maxDecisionsPerRequest = execution.maxDecisionsPerRequest;
  const providerKind = provider.kind;
  const model = provider.model;
  const apiKeyEnv = provider.apiKeyEnv;

  if (
    !isPositiveInteger(concurrency) ||
    !isPositiveInteger(maxDecisionsPerRequest) ||
    providerKind !== "typesafe" ||
    typeof model !== "string" ||
    typeof apiKeyEnv !== "string"
  ) {
    throw new Error(`semantic lint configが不正です: ${origin}`);
  }

  return {
    version: 1,
    rulesDir,
    casesDir,
    excludePaths,
    execution: {
      concurrency,
      maxDecisionsPerRequest,
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

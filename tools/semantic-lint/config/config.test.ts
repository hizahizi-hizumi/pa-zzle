import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileConfig } from "./config.ts";

describe("compileConfig", () => {
  test("YAML configをruntime configへ変換する", () => {
    const value = YAML.parse(`
version: 1
rulesDir: .semantic-lint/rules
excludePaths:
  - "**/.env*"
execution:
  concurrency: 8
  requestTokenBudget:
    stateAndQuestion: 32000
    total: 64000
provider:
  kind: typesafe
  model: jev-latest
  apiKeyEnv: TYPESAFE_API_KEY
`);

    expect(compileConfig(value)).toEqual({
      version: 1,
      rulesDir: ".semantic-lint/rules",
      goldenDir: ".semantic-lint/golden",
      excludePaths: ["**/.env*"],
      execution: {
        concurrency: 8,
        requestTokenBudget: { stateAndQuestion: 32_000, total: 64_000 },
      },
      provider: {
        kind: "typesafe",
        model: "jev-latest",
        apiKeyEnv: "TYPESAFE_API_KEY",
      },
    });
  });

  test("0以下の並列数を拒否する", () => {
    expect(() =>
      compileConfig({
        version: 1,
        rulesDir: ".semantic-lint/rules",
        excludePaths: [],
        execution: {
          concurrency: 0,
        },
        provider: {
          kind: "typesafe",
          model: "jev-latest",
          apiKeyEnv: "TYPESAFE_API_KEY",
        },
      }),
    ).toThrow("semantic lint configが不正");
  });

  test("廃止したmaxDecisionsPerRequestを拒否する", () => {
    expect(() =>
      compileConfig({
        version: 1,
        rulesDir: ".semantic-lint/rules",
        excludePaths: [],
        execution: {
          concurrency: 8,
          maxDecisionsPerRequest: 64,
        },
        provider: {
          kind: "typesafe",
          model: "jev-latest",
          apiKeyEnv: "TYPESAFE_API_KEY",
        },
      }),
    ).toThrow("requestTokenBudget");
  });
});

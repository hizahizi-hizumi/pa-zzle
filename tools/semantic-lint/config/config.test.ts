import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileConfig } from "./config.ts";

describe("compileConfig", () => {
  test("YAML configをruntime configへ変換する", () => {
    const value = YAML.parse(`
version: 1
rulesDir: .semantic-lint/rules
casesDir: .semantic-lint/cases
excludePaths:
  - "**/.env*"
execution:
  concurrency: 8
  maxDecisionsPerRequest: 64
provider:
  kind: typesafe
  model: jev-latest
  apiKeyEnv: TYPESAFE_API_KEY
`);

    expect(compileConfig(value)).toEqual({
      version: 1,
      rulesDir: ".semantic-lint/rules",
      casesDir: ".semantic-lint/cases",
      excludePaths: ["**/.env*"],
      execution: {
        concurrency: 8,
        maxDecisionsPerRequest: 64,
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
        casesDir: ".semantic-lint/cases",
        excludePaths: [],
        execution: {
          concurrency: 0,
          maxDecisionsPerRequest: 64,
        },
        provider: {
          kind: "typesafe",
          model: "jev-latest",
          apiKeyEnv: "TYPESAFE_API_KEY",
        },
      }),
    ).toThrow("semantic lint configが不正");
  });
});

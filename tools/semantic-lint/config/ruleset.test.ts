import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileRuleset } from "./ruleset.ts";

const UNITS = new Set(["file", "test", "setup"]);

function rulesetWith(
  rule: Record<string, unknown>,
  ruleset: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    version: 1,
    id: "vitest",
    paths: ["frontend/**/*.test.ts"],
    rules: [
      {
        id: "sample",
        title: "sample",
        unit: "test",
        violationThreshold: 0.9,
        instruction: "classify",
        ...rule,
      },
    ],
    ...ruleset,
  };
}

describe("compileRuleset", () => {
  test("rulesetのpathsをruleへ展開し、severityを省略するとwarningにする", () => {
    const value = YAML.parse(`
version: 1
id: vitest
paths:
  - frontend/**/*.test.ts
rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    unit: test
    violationThreshold: 0.9
    instruction: |
      Classify the subject.
`);

    const rules = compileRuleset(value, "vitest.yaml", UNITS);

    expect(rules).toEqual([
      {
        id: "vitest/arrange-outside-test",
        rulesetId: "vitest",
        title: "テスト本体にArrangeを置かない",
        severity: "warning",
        violationThreshold: 0.9,
        unit: "test",
        paths: ["frontend/**/*.test.ts"],
        instruction: "Classify the subject.\n",
      },
    ]);
  });

  test.each(["info", "warning", "error"])("severity: %sを指定できる", (severity) => {
    const [rule] = compileRuleset(
      rulesetWith({ severity }),
      "vitest.yaml",
      UNITS,
    );

    expect(rule?.severity).toBe(severity);
  });

  test.each([
    ["instructionなし", { instruction: undefined }],
    ["空のinstruction", { instruction: "  \n" }],
  ])("%sのruleを拒否する", (_, override) => {
    expect(() =>
      compileRuleset(rulesetWith(override), "vitest.yaml", UNITS),
    ).toThrow("rule設定が不正です");
  });

  test.each([
    ["未知のunit", { unit: "vitest.test" }, "ruleのunitが未知です: vitest.test"],
    ["unitなし", { unit: undefined }, "ruleのunitが未知です: undefined"],
    [
      "thresholdなし",
      { violationThreshold: undefined },
      "violationThresholdには0〜1の数値を指定してください",
    ],
    [
      "範囲外のthreshold",
      { violationThreshold: 1.5 },
      "violationThresholdには0〜1の数値を指定してください",
    ],
    [
      "廃止したlifecycle",
      { status: "draft" },
      "ruleに書けないkeyがあります: status",
    ],
    [
      "未知のseverity",
      { severity: "fatal" },
      "severityにはinfo / warning / errorを指定してください",
    ],
    [
      "廃止したsourceSection",
      { sourceSection: "テスト構造" },
      "ruleに書けないkeyがあります: sourceSection",
    ],
    [
      "廃止したoutcomes",
      { outcomes: { violation: "v" } },
      "ruleに書けないkeyがあります: outcomes",
    ],
    [
      "廃止したpredicate",
      { instruction: undefined, predicate: { instruction: "classify", outcomes: { violation: "v" } } },
      "ruleに書けないkeyがあります: predicate",
    ],
    [
      "抽出方法の指定",
      { selector: "call_expression" },
      "ruleに書けないkeyがあります: selector",
    ],
  ])("%sを拒否する", (_, override, message) => {
    expect(() =>
      compileRuleset(rulesetWith(override), "vitest.yaml", UNITS),
    ).toThrow(message);
  });

  test.each([
    ["source", { source: { path: ".claude/rules/vitest.md" } }],
    ["defaults", { defaults: { violationThreshold: 0.9 } }],
  ])("rulesetの未知のkey %s を拒否する", (key, override) => {
    expect(() =>
      compileRuleset(rulesetWith({}, override), "vitest.yaml", UNITS),
    ).toThrow(`rulesetに書けないkeyがあります: ${key}`);
  });
});

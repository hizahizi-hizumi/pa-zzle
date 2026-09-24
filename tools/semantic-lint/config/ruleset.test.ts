import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileRuleset } from "./ruleset.ts";

const UNITS = new Set(["file", "test", "setup"]);

describe("compileRuleset", () => {
  test("ruleset defaultsをruleへ展開する", () => {
    const value = YAML.parse(`
version: 1
id: vitest
paths:
  - frontend/**/*.test.ts
source:
  path: .claude/rules/vitest.md
defaults:
  status: draft
  severity: warning
  violationThreshold: 0.9
rules:
  - id: arrange-outside-test
    title: テスト本体にArrangeを置かない
    unit: test
    sourceSection: テスト構造
    predicate:
      instruction: |
        Classify the subject.
      outcomes:
        violation: violation
        compliant: compliant
        not_applicable: not applicable
        insufficient_context: insufficient context
`);

    const rules = compileRuleset(value, "vitest.yaml", UNITS);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: "vitest/arrange-outside-test",
      rulesetId: "vitest",
      title: "テスト本体にArrangeを置かない",
      status: "draft",
      severity: "warning",
      violationThreshold: 0.9,
      unit: "test",
      paths: ["frontend/**/*.test.ts"],
      source: {
        path: ".claude/rules/vitest.md",
        section: "テスト構造",
      },
      predicate: {
        instruction: "Classify the subject.\n",
        outcomes: {
          violation: "violation",
          compliant: "compliant",
          not_applicable: "not applicable",
          insufficient_context: "insufficient context",
        },
      },
    });
  });

  test("rule単位のpolicy overrideを許可する", () => {
    const value = {
      version: 1,
      id: "vitest",
      paths: ["frontend/**/*.test.ts"],
      source: { path: ".claude/rules/vitest.md" },
      defaults: {
        status: "draft",
        severity: "warning",
        violationThreshold: 0.9,
      },
      rules: [
        {
          id: "sample",
          title: "sample",
          status: "active",
          severity: "error",
          violationThreshold: 0.95,
          unit: "file",
          sourceSection: "sample",
          predicate: {
            instruction: "classify",
            outcomes: {
              violation: "v",
              compliant: "c",
              not_applicable: "n",
              insufficient_context: "i",
            },
          },
        },
      ],
    };

    const [rule] = compileRuleset(value, "vitest.yaml", UNITS);

    expect(rule?.status).toBe("active");
    expect(rule?.severity).toBe("error");
    expect(rule?.violationThreshold).toBe(0.95);
  });

  test("outcomeが欠けているruleを拒否する", () => {
    const value = {
      version: 1,
      id: "vitest",
      paths: ["frontend/**/*.test.ts"],
      source: { path: ".claude/rules/vitest.md" },
      defaults: {
        status: "draft",
        severity: "warning",
        violationThreshold: 0.9,
      },
      rules: [
        {
          id: "sample",
          title: "sample",
          unit: "file",
          sourceSection: "sample",
          predicate: {
            instruction: "classify",
            outcomes: {
              violation: "v",
            },
          },
        },
      ],
    };

    expect(() => compileRuleset(value, "vitest.yaml", UNITS)).toThrow(
      "predicate.outcomes.compliant",
    );
  });

  test.each([
    ["未知のunit", { unit: "vitest.test" }, "ruleのunitが未知です: vitest.test"],
    ["unitなし", { unit: undefined }, "ruleのunitが未知です: undefined"],
    [
      "廃止したscope",
      { scope: "vitest.test" },
      "ruleに書けないkeyがあります: scope",
    ],
    [
      "抽出方法の指定",
      { selector: "call_expression" },
      "ruleに書けないkeyがあります: selector",
    ],
  ])("%sを拒否する", (_, override, message) => {
    const value = {
      version: 1,
      id: "vitest",
      paths: ["frontend/**/*.test.ts"],
      source: { path: ".claude/rules/vitest.md" },
      defaults: {
        status: "draft",
        severity: "warning",
        violationThreshold: 0.9,
      },
      rules: [
        {
          id: "sample",
          title: "sample",
          unit: "test",
          sourceSection: "sample",
          predicate: {
            instruction: "classify",
            outcomes: {
              violation: "v",
              compliant: "c",
              not_applicable: "n",
              insufficient_context: "i",
            },
          },
          ...override,
        },
      ],
    };

    expect(() => compileRuleset(value, "vitest.yaml", UNITS)).toThrow(message);
  });
});

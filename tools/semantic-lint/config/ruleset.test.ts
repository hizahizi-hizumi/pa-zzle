import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileRuleset } from "./ruleset.ts";

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
    scope: vitest.test
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

    const rules = compileRuleset(value, "vitest.yaml");

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: "vitest/arrange-outside-test",
      rulesetId: "vitest",
      title: "テスト本体にArrangeを置かない",
      status: "draft",
      severity: "warning",
      violationThreshold: 0.9,
      scope: "vitest.test",
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
          scope: "file",
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

    const [rule] = compileRuleset(value, "vitest.yaml");

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
          scope: "file",
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

    expect(() => compileRuleset(value, "vitest.yaml")).toThrow(
      "predicate.outcomes.compliant",
    );
  });

  test("unitだけを指定したruleをscopeなしで展開する", () => {
    const rules = compileRuleset(targetRuleset("unit: function"), "unit.yaml");

    expect(rules[0]?.unit).toBe("function");
    expect(rules[0]?.scope).toBeUndefined();
  });

  test("scopeとunitの同時指定と、どちらもない指定を拒否する", () => {
    expect(() =>
      compileRuleset(
        targetRuleset("scope: vitest.test\n    unit: function"),
        "both.yaml",
      ),
    ).toThrow("scopeとunitは同時に指定できません");
    expect(() => compileRuleset(targetRuleset(""), "none.yaml")).toThrow(
      "scopeまたはunitが必要です",
    );
  });
});

function targetRuleset(target: string): unknown {
  return YAML.parse(`
version: 1
id: sample
paths:
  - frontend/**/*.test.ts
source:
  path: .claude/rules/vitest.md
defaults:
  status: draft
  severity: warning
  violationThreshold: 0.5
rules:
  - id: rule
    title: rule
    ${target}
    sourceSection: テスト構造
    predicate:
      instruction: Classify.
      outcomes:
        violation: v
        compliant: c
        not_applicable: n
        insufficient_context: i
`);
}

import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileCandidateAnchorBenchmark } from "./benchmark.ts";

describe("compileCandidateAnchorBenchmark", () => {
  test("最小ruleとfinding期待値を読み込める", () => {
    const value = YAML.parse(`
version: 1
rules:
  - id: sample
    title: sample rule
    violationThreshold: 0.9
    predicate:
      instruction: 判定する
      outcomes:
        violation: 違反
        compliant: 適合
        not_applicable: 対象外
        insufficient_context: 文脈不足
cases:
  - rule: sample
    name: sample case
    fixture: fixture.ts
    expectedFindings:
      - text: hoge
`);

    const benchmark = compileCandidateAnchorBenchmark(value, "/repo/benchmark.yaml");

    expect(benchmark.rules[0]?.id).toBe("sample");
    expect(benchmark.rules[0]?.targetFamily).toBeUndefined();
    expect(benchmark.cases[0]?.expectedFindings).toEqual([
      { text: "hoge", occurrence: 1 },
    ]);
  });

  test("target familyを読み込める", () => {
    const value = YAML.parse(`
version: 1
rules:
  - id: sample
    title: sample rule
    targetFamily: callback-call
    violationThreshold: 0.9
    predicate:
      instruction: 判定する
      outcomes:
        violation: 違反
        compliant: 適合
        not_applicable: 対象外
        insufficient_context: 文脈不足
cases:
  - rule: sample
    name: sample case
    fixture: fixture.ts
    expectedFindings: []
`);

    const benchmark = compileCandidateAnchorBenchmark(
      value,
      "/repo/benchmark.yaml",
    );

    expect(benchmark.rules[0]?.targetFamily).toBe("callback-call");
  });

});

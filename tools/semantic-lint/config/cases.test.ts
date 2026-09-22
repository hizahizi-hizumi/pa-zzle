import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

import { compileCaseManifest } from "./cases.ts";

describe("compileCaseManifest", () => {
  test("expectedFindingsでtextとrangeを指定できる", () => {
    const value = YAML.parse(`
version: 1
ruleset: vitest
cases:
  - rule: sample
    name: 指摘位置を持つ
    fixture: fixture.ts
    expected: violation
    expectedFindings:
      - text: hoge
        occurrence: 2
      - range:
          startLine: 3
          startColumn: 5
          endLine: 3
          endColumn: 9
`);

    const [goldenCase] = compileCaseManifest(value, "/repo/cases.yaml");

    expect(goldenCase?.expectedFindings).toEqual([
      { text: "hoge", occurrence: 2 },
      {
        range: {
          startLine: 3,
          startColumn: 5,
          endLine: 3,
          endColumn: 9,
        },
      },
    ]);
  });

  test("expectedFindingsの空配列を許可する", () => {
    const value = YAML.parse(`
version: 1
ruleset: vitest
cases:
  - rule: sample
    name: 指摘なし
    fixture: fixture.ts
    expected: compliant
    expectedFindings: []
`);

    const [goldenCase] = compileCaseManifest(value, "/repo/cases.yaml");

    expect(goldenCase?.expectedFindings).toEqual([]);
  });

  test("expectedFindingsのoccurrenceは正の整数だけ許可する", () => {
    const value = YAML.parse(`
version: 1
ruleset: vitest
cases:
  - rule: sample
    name: 不正なoccurrence
    fixture: fixture.ts
    expected: violation
    expectedFindings:
      - text: hoge
        occurrence: 0
`);

    expect(() => compileCaseManifest(value, "/repo/cases.yaml")).toThrow(
      "expectedFindings.occurrence",
    );
  });
  test("expectedFindingsはtextとrangeの同時指定を拒否する", () => {
    const value = YAML.parse(`
version: 1
ruleset: vitest
cases:
  - rule: sample
    name: 不正な複合指定
    fixture: fixture.ts
    expected: violation
    expectedFindings:
      - text: hoge
        range:
          startLine: 1
          startColumn: 1
          endLine: 1
          endColumn: 5
`);

    expect(() => compileCaseManifest(value, "/repo/cases.yaml")).toThrow(
      "どちらか一方",
    );
  });

});

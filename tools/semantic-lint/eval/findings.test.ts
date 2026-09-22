import { describe, expect, test } from "bun:test";

import type { Finding } from "../domain/model.ts";
import {
  compareFindingRanges,
  resolveExpectedFindingRanges,
} from "./findings.ts";

describe("golden finding expectations", () => {
  test("textのoccurrenceからparser互換のrangeを求める", () => {
    const source = "const hoge = 1;\nconst hoge = 2;\n";

    expect(
      resolveExpectedFindingRanges(source, [
        { text: "hoge", occurrence: 2 },
      ]),
    ).toEqual([
      {
        startLine: 2,
        startColumn: 7,
        endLine: 2,
        endColumn: 11,
      },
    ]);
  });

  test("期待rangeと実際のfindingが完全一致したときだけexactになる", () => {
    const expectedRanges = [
      {
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 14,
      },
    ];

    expect(compareFindingRanges(expectedRanges, [finding(expectedRanges[0]!)])).toMatchObject({
      matched: 1,
      exact: true,
    });

    expect(
      compareFindingRanges(expectedRanges, [
        finding(expectedRanges[0]!),
        finding({
          startLine: 3,
          startColumn: 7,
          endLine: 3,
          endColumn: 19,
        }),
      ]),
    ).toMatchObject({
      matched: 1,
      exact: false,
    });
  });
});

function finding(range: Finding["range"]): Finding {
  return {
    ruleId: "vitest/sample",
    severity: "warning",
    message: "sample",
    path: "frontend/example.test.ts",
    range,
    source: {
      path: ".claude/rules/vitest.md",
      section: "sample",
    },
  };
}

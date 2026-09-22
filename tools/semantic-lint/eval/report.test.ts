import { describe, expect, test } from "bun:test";

import type { GoldenCaseResult } from "./run.ts";
import { renderGoldenCaseReport } from "./report.ts";
import { decisionResult, sampleRule } from "../testing/fixtures.ts";

describe("renderGoldenCaseReport", () => {
  test("expectedFindingsがあるcaseは指摘位置一致を表示する", () => {
    const result: GoldenCaseResult = {
      case: {
        rulesetId: "vitest",
        ruleId: "vitest/sample",
        name: "位置を確認する",
        fixturePath: "/repo/fixture.ts",
        expected: "violation",
        expectedFindings: [
          {
            range: {
              startLine: 1,
              startColumn: 7,
              endLine: 1,
              endColumn: 11,
            },
          },
        ],
      },
      rule: sampleRule(),
      runs: [
        {
          result: decisionResult("violation", 0.95),
          findings: [],
          findingComparison: {
            expectedRanges: [
              {
                startLine: 1,
                startColumn: 7,
                endLine: 1,
                endColumn: 11,
              },
            ],
            actualRanges: [],
            matched: 0,
            exact: false,
          },
          inputTokens: 10,
          outputTokens: 1,
          durationMs: 20,
        },
      ],
    };

    const output = renderGoldenCaseReport([result]);

    expect(output).toContain("指摘位置一致: 0/1 (0.0%)");
    expect(output).toContain("期待位置: 1:7-1:11");
    expect(output).toContain("実際位置: なし");
  });
});

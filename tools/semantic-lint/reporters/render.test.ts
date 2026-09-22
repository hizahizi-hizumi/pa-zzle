import { describe, expect, test } from "bun:test";

import type { RunResult } from "../domain/model.ts";
import { renderCompact, renderPretty, renderRunResult } from "./render.ts";

describe("RunResult reporters", () => {
  test("prettyはcanonical diagnosticをfileごとに表示する", () => {
    const output = renderPretty(sampleResult());

    expect(output).toContain("frontend/example.test.ts");
    expect(output).toContain("3:1-8:3");
    expect(output).toContain("warning");
    expect(output).toContain("vitest/sample");
    expect(output).toContain('symbol=test("例こと")');
    expect(output).toContain("1 warning");
    expect(output).toContain("0 errors");
  });

  test("compactは1 diagnostic 1行にする", () => {
    expect(renderCompact(sampleResult())).toBe(
      "frontend/example.test.ts:3:1-8:3 warning vitest/sample sample diagnostic\n",
    );
  });

  test("jsonはRunResultそのものをversion付きで出力する", () => {
    const parsed = JSON.parse(renderRunResult(sampleResult(), "json"));

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.diagnostics).toHaveLength(1);
  });
});

function sampleResult(): RunResult {
  return {
    schemaVersion: 1,
    diagnostics: [
      {
        ruleId: "vitest/sample",
        severity: "warning",
        message: "sample diagnostic",
        path: "frontend/example.test.ts",
        range: {
          startLine: 3,
          startColumn: 1,
          endLine: 8,
          endColumn: 3,
        },
        symbol: 'test("例こと")',
        probability: 0.96,
        confidence: 0.95,
        source: {
          path: ".claude/rules/vitest.md",
          section: "テスト構造",
        },
      },
    ],
    unknowns: [],
    evaluations: [],
    metrics: {
      scannedFiles: 1,
      subjects: 1,
      plannedEvaluations: 1,
      providerRequests: 1,
      providerDecisions: 1,
      diagnostics: 1,
      unknowns: 0,
      inputTokens: 123,
      outputTokens: 0,
      totalDurationMs: 250,
      providerLatencyMs: [200],
    },
  };
}

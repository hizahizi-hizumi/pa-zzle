import { describe, expect, test } from "bun:test";

import type { Finding, RunResult } from "../domain/model.ts";
import { renderCompact, renderPretty, renderRunResult } from "./render.ts";

describe("RunResult reporters", () => {
  test("prettyはfindingのcode frameを表示する", () => {
    const result = sampleResult([
      finding({
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 14,
      }),
    ]);
    const output = renderPretty(result, [
      {
        path: "frontend/example.test.ts",
        source: "const badName = foo();\n",
      },
    ]);

    expect(output).toContain(
      "frontend/example.test.ts:1:7 vitest/sample ━━━━━━━━━━━━━━━",
    );
    expect(output).toContain("⚠ sample diagnostic");
    expect(output).toContain("> 1 │ const badName = foo();");
    expect(output).toContain("│       ^^^^^^^");
    expect(output).toContain("1 warning");
    expect(output).toContain("0 errors");
    expect(output).not.toContain("violation=");
    expect(output).not.toContain("confidence=");
  });

  test("prettyは同一ruleで表示窓が重なるfindingだけ1 code frameにまとめる", () => {
    const result = sampleResult([
      finding({
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 14,
      }),
      finding({
        startLine: 3,
        startColumn: 7,
        endLine: 3,
        endColumn: 19,
      }),
    ]);
    const output = renderPretty(result, [
      {
        path: "frontend/example.test.ts",
        source:
          "const badName = foo();\ndoSomething();\nconst otherBadName = bar();\n",
      },
    ]);

    expect(countOccurrences(output, "vitest/sample ━━━━━━━━━━━━━━━")).toBe(1);
    expect(output).toContain("sample diagnostic (2 findings)");
    expect(output).toContain("  2 │ doSomething();");
    expect(output).not.toContain("> 2 │ doSomething();");
  });

  test("prettyは異なるruleのfindingを同じcode frameにまとめない", () => {
    const first = finding({
      startLine: 1,
      startColumn: 7,
      endLine: 1,
      endColumn: 14,
    });
    const second = {
      ...finding({
        startLine: 3,
        startColumn: 7,
        endLine: 3,
        endColumn: 19,
      }),
      ruleId: "vitest/other",
      message: "other diagnostic",
    };
    const output = renderPretty(sampleResult([first, second]), [
      {
        path: "frontend/example.test.ts",
        source:
          "const badName = foo();\ndoSomething();\nconst otherBadName = bar();\n",
      },
    ]);

    expect(countOccurrences(output, "━━━━━━━━━━━━━━━")).toBe(2);
  });

  test("prettyは表示窓が重ならないfindingを別code frameにする", () => {
    const result = sampleResult([
      finding({
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 14,
      }),
      finding({
        startLine: 5,
        startColumn: 7,
        endLine: 5,
        endColumn: 19,
      }),
    ]);
    const output = renderPretty(result, [
      {
        path: "frontend/example.test.ts",
        source:
          "const badName = foo();\na();\nb();\nc();\nconst otherBadName = bar();\n",
      },
    ]);

    expect(countOccurrences(output, "vitest/sample ━━━━━━━━━━━━━━━")).toBe(2);
  });

  test("compactは1 finding 1行にする", () => {
    const result = sampleResult([
      finding({
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 14,
      }),
      finding({
        startLine: 3,
        startColumn: 7,
        endLine: 3,
        endColumn: 19,
      }),
    ]);

    expect(renderCompact(result)).toBe(
      "frontend/example.test.ts:1:7-1:14 warning vitest/sample sample diagnostic\n" +
        "frontend/example.test.ts:3:7-3:19 warning vitest/sample sample diagnostic\n",
    );
  });

  test("jsonはRunResultそのものをversion付きで出力する", () => {
    const parsed = JSON.parse(
      renderRunResult(
        sampleResult([
          finding({
            startLine: 1,
            startColumn: 7,
            endLine: 1,
            endColumn: 14,
          }),
        ]),
        "json",
      ),
    );

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.diagnostics).toHaveLength(1);
  });
});

function sampleResult(diagnostics: Finding[]): RunResult {
  return {
    schemaVersion: 1,
    diagnostics,
    unknowns: [],
    evaluations: [],
    metrics: {
      scannedFiles: 1,
      subjects: diagnostics.length,
      plannedEvaluations: diagnostics.length,
      providerRequests: 1,
      providerDecisions: diagnostics.length,
      diagnostics: diagnostics.length,
      unknowns: 0,
      inputTokens: 123,
      outputTokens: 0,
      totalDurationMs: 250,
      providerLatencyMs: [200],
    },
  };
}

function finding(range: Finding["range"]): Finding {
  return {
    ruleId: "vitest/sample",
    severity: "warning",
    message: "sample diagnostic",
    path: "frontend/example.test.ts",
    range,
    source: {
      path: ".claude/rules/vitest.md",
      section: "テスト構造",
    },
  };
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

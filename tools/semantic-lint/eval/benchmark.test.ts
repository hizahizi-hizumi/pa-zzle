import { describe, expect, test } from "bun:test";

import { ScopeRegistry } from "../scopes/registry.ts";
import { FakeDecisionProvider } from "../testing/fake-provider.ts";
import { decisionResult, sampleRule } from "../testing/fixtures.ts";
import { runGoldenBenchmark } from "./benchmark.ts";
import { buildBenchmarkReport, renderBenchmarkReport } from "./benchmark-report.ts";
import type { GoldenSet, ResolvedGoldenFile } from "./golden.ts";

describe("runGoldenBenchmark", () => {
  const rule = sampleRule({ status: "draft", violationThreshold: 0.8 });
  const golden: GoldenSet = {
    ruleId: rule.id,
    baseCommit: "a".repeat(40),
    origin: "golden.yaml",
    files: [
      {
        path: "violation.test.ts",
        blob: "b".repeat(40),
        findings: [{ startLine: 2, endLine: 2 }],
      },
      {
        path: "clean.test.ts",
        blob: "c".repeat(40),
        findings: [],
      },
    ],
  };
  const files: ResolvedGoldenFile[] = golden.files.map((file) => ({
    ...file,
    source: "const a = 1;\nconst b = 2;\n",
    status: "current",
  }));

  test("draft ruleもgolden対象ファイルだけで繰り返し評価して採点する", async () => {
    let cleanCalls = 0;
    const provider = new FakeDecisionProvider({
      [`${rule.id}::file:violation.test.ts:0`]: decisionResult("violation", 0.95),
      [`${rule.id}::file:clean.test.ts:0`]: () => {
        cleanCalls += 1;
        return decisionResult("violation", cleanCalls === 1 ? 0.85 : 0.6);
      },
    });

    const results = await runGoldenBenchmark({
      targets: [{ golden, files }],
      rules: [rule],
      scopes: new ScopeRegistry(),
      provider,
      repeat: 2,
      concurrency: 1,
      maxDecisionsPerRequest: 64,
    });
    const report = buildBenchmarkReport(results, { lineTolerance: 0 });
    const ruleReport = report.rules[0];

    expect(provider.requests).toHaveLength(4);
    expect(ruleReport?.runs.map((run) => run.files.precision)).toEqual([0.5, 1]);
    expect(ruleReport?.summary.containmentRecall.mean).toBe(1);
    expect(ruleReport?.summary.strictRecall.mean).toBe(0);
    expect(ruleReport?.summary.providerRequests.mean).toBe(2);
    expect(ruleReport?.stability.unstable).toEqual([
      { path: "clean.test.ts", startLine: 1, endLine: 3, runs: 1 },
    ]);
    expect(
      ruleReport?.thresholdSweep?.find((row) => row.threshold === 0.9)
        ?.filePrecision.mean,
    ).toBe(1);
    expect(renderBenchmarkReport(report)).toContain(
      "clean.test.ts:1-3 (1/2)",
    );
  });
});

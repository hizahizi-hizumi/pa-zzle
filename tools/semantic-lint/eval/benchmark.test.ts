import { describe, expect, test } from "bun:test";

import { DEFAULT_REQUEST_TOKEN_BUDGET } from "../config/config.ts";
import { FakeDecisionProvider } from "../testing/fake-provider.ts";
import {
  decisionResult,
  sampleRule,
  testExtractor,
} from "../testing/fixtures.ts";
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

    const result = await runGoldenBenchmark({
      targets: [{ golden, files }],
      rules: [rule],
      extractor: await testExtractor(),
      provider,
      repeat: 2,
      concurrency: 1,
      requestTokenBudget: DEFAULT_REQUEST_TOKEN_BUDGET,
    });
    const report = buildBenchmarkReport(result.rules, {
      lineTolerance: 0,
      usage: {
        lineRules: result.plan.lineRules,
        planned: result.plan.requests,
        runRequests: result.runRequests,
      },
    });
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

  test("fileごとに、そのfileをgoldenに持つruleだけを1 requestへまとめ、usageをruleへ按分する", async () => {
    const other = sampleRule({ id: "vitest/other", status: "active" });
    const otherGolden: GoldenSet = {
      ...golden,
      ruleId: other.id,
      files: [{ path: "clean.test.ts", blob: "c".repeat(40), findings: [] }],
    };
    const provider = new FakeDecisionProvider({
      [`${rule.id}::file:violation.test.ts:0`]: decisionResult("violation", 0.95),
      [`${rule.id}::file:clean.test.ts:0`]: decisionResult("compliant", 0.1),
      [`${other.id}::file:clean.test.ts:0`]: decisionResult("compliant", 0.1),
    });

    const result = await runGoldenBenchmark({
      targets: [
        { golden, files },
        { golden: otherGolden, files: files.slice(1) },
      ],
      rules: [rule, other],
      extractor: await testExtractor(),
      provider,
      repeat: 1,
      concurrency: 1,
      requestTokenBudget: DEFAULT_REQUEST_TOKEN_BUDGET,
    });
    const report = buildBenchmarkReport(result.rules, {
      lineTolerance: 0,
      usage: {
        lineRules: result.plan.lineRules,
        planned: result.plan.requests,
        runRequests: result.runRequests,
      },
    });

    expect(provider.requests.map((batch) => batch.requests.length)).toEqual([
      2, 1,
    ]);
    expect(result.plan.lineRules).toBe(3 * 3);
    expect(report.rules.map((item) => item.summary.providerRequests.mean)).toEqual([2, 1]);
    // fakeのusageは質問1つ100 token。按分の合計はrequest全体の実usageに一致する。
    expect(
      report.rules.reduce(
        (sum, item) => sum + (item.summary.inputTokens.mean ?? 0),
        0,
      ),
    ).toBe(300);
    expect(report.usage?.inputTokens.mean).toBe(300);
    expect(report.usage?.actualToEstimate).not.toBeNull();
  });
});

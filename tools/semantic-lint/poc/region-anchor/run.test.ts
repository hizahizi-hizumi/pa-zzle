import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../../domain/model.ts";
import { loadRegionAnchorBenchmark } from "./benchmark.ts";
import { runRegionAnchorBenchmark } from "./run.ts";

describe("runRegionAnchorBenchmark", () => {
  test("file gate後にArrangeのstatement anchorへ位置特定できる", async () => {
    const benchmark = await loadBenchmark();
    const selected = selectCase(benchmark, "Arrangeを1件だけ指す");

    const result = await runRegionAnchorBenchmark({
      benchmark: selected,
      provider: new StubProvider({
        positiveRegions: new Set(["arrange-outside-test"]),
        locationSymbols: new Set(["variable(values):statement"]),
      }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.cases[0]?.regionPassed).toBe(true);
    expect(result.cases[0]?.exact).toBe(true);
    expect(result.cases[0]?.findings[0]?.range).toEqual({
      startLine: 3,
      startColumn: 5,
      endLine: 3,
      endColumn: 30,
    });
  });

  test("Candidate分類なしでidentifierだけをprimary locationにできる", async () => {
    const benchmark = await loadBenchmark();
    const selected = selectCase(benchmark, "命名違反はidentifierだけを指す");

    const result = await runRegionAnchorBenchmark({
      benchmark: selected,
      provider: new StubProvider({
        positiveRegions: new Set(["meaningful-variable-name"]),
        locationSymbols: new Set(["variable(hoge):name"]),
      }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.cases[0]?.findings[0]?.range).toEqual({
      startLine: 1,
      startColumn: 7,
      endLine: 1,
      endColumn: 11,
    });
  });

  test("file gateがfalse negativeならlocalizationを実行しない", async () => {
    const benchmark = await loadBenchmark();
    const selected = selectCase(benchmark, "Arrangeを1件だけ指す");

    const result = await runRegionAnchorBenchmark({
      benchmark: selected,
      provider: new StubProvider({
        positiveRegions: new Set(),
        locationSymbols: new Set(),
      }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.cases[0]?.regionPassed).toBe(false);
    expect(result.cases[0]?.localizationDecisions).toBe(0);
    expect(result.cases[0]?.actualFindings).toBe(0);
    expect(result.cases[0]?.exact).toBe(false);
  });

  test("describe全体をprimary locationにできる", async () => {
    const benchmark = await loadBenchmark();
    const selected = selectCase(benchmark, "describe全体の反復を指す");

    const result = await runRegionAnchorBenchmark({
      benchmark: selected,
      provider: new StubProvider({
        positiveRegions: new Set(["table-driven-cases"]),
        locationSymbols: new Set(["call(describe):self"]),
      }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.cases[0]?.exact).toBe(true);
  });
});

async function loadBenchmark() {
  const projectRoot = resolve(import.meta.dir, "../../../..");
  return loadRegionAnchorBenchmark(
    resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
  );
}

function selectCase(
  benchmark: Awaited<ReturnType<typeof loadBenchmark>>,
  name: string,
) {
  const cases = benchmark.cases.filter((item) => item.name === name);
  const ruleIds = new Set(cases.map((item) => item.ruleId));

  return {
    ...benchmark,
    cases,
    rules: benchmark.rules.filter((rule) => ruleIds.has(rule.id)),
  };
}

class StubProvider implements SemanticDecisionProvider {
  constructor(
    private readonly options: {
      positiveRegions: Set<string>;
      locationSymbols: Set<string>;
    },
  ) {}

  async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
    const subjects = new Map(batch.subjects.map((subject) => [subject.id, subject]));
    const decisions: Record<string, DecisionResult> = {};

    for (const request of batch.requests) {
      const subject = subjects.get(request.subjectId);

      if (!subject) {
        throw new Error(`subjectがありません: ${request.subjectId}`);
      }

      const ruleName = request.ruleId
        .replace(/^poc\//, "")
        .replace(/\/(region|location)$/, "");
      const violation = request.ruleId.endsWith("/region")
        ? this.options.positiveRegions.has(ruleName)
        : this.options.locationSymbols.has(subject.symbol ?? "");

      decisions[request.taskId] = decision(
        violation ? "violation" : "compliant",
      );
    }

    return {
      provider: { kind: "stub", model: "stub" },
      decisions,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

function decision(value: "violation" | "compliant"): DecisionResult {
  return {
    decision: value,
    confidence: 0.99,
    probabilities: {
      violation: value === "violation" ? 0.99 : 0.01,
      compliant: value === "compliant" ? 0.99 : 0.01,
      not_applicable: 0,
      insufficient_context: 0,
    },
  };
}

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../../domain/model.ts";
import { loadCandidateAnchorBenchmark } from "./benchmark.ts";
import { runCandidateAnchorBenchmark } from "./run.ts";

describe("runCandidateAnchorBenchmark", () => {
  test("意味判定後にstatement anchorへ位置特定できる", async () => {
    const projectRoot = resolve(import.meta.dir, "../../../..");
    const benchmark = await loadCandidateAnchorBenchmark(
      resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
    );
    const selected = {
      ...benchmark,
      cases: benchmark.cases.filter(
        (benchmarkCase) => benchmarkCase.name === "Arrangeを1件だけ指す",
      ),
      rules: benchmark.rules.filter(
        (rule) => rule.id === "arrange-outside-test",
      ),
    };
    const provider = new StubProvider();

    const result = await runCandidateAnchorBenchmark({
      benchmark: selected,
      provider,
      maxDecisionsPerRequest: 64,
    });

    expect(result.cases[0]?.exact).toBe(true);
    expect(result.cases[0]?.findings[0]?.range).toEqual({
      startLine: 3,
      startColumn: 5,
      endLine: 3,
      endColumn: 30,
    });
    expect(result.metrics.localizationDecisions).toBeGreaterThan(0);
  });
});

class StubProvider implements SemanticDecisionProvider {
  async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
    const decisions: Record<string, DecisionResult> = {};
    const subjectsById = new Map(
      batch.subjects.map((subject) => [subject.id, subject]),
    );

    for (const request of batch.requests) {
      const subject = subjectsById.get(request.subjectId);

      if (!subject) {
        throw new Error(`subjectがありません: ${request.subjectId}`);
      }

      const isLocation = request.ruleId.endsWith("/location");
      const matches = isLocation
        ? subject.symbol === "variable(values):statement"
        : subject.symbol === "variable(values)";
      decisions[request.taskId] = result(matches ? "violation" : "compliant");
    }

    return {
      provider: { kind: "stub", model: "stub" },
      decisions,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

function result(decision: "violation" | "compliant"): DecisionResult {
  return {
    decision,
    confidence: 0.99,
    probabilities: {
      violation: decision === "violation" ? 0.99 : 0.01,
      compliant: decision === "compliant" ? 0.99 : 0.01,
      not_applicable: 0,
      insufficient_context: 0,
    },
  };
}

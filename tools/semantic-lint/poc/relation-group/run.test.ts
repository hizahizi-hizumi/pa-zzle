import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../../domain/model.ts";
import { loadCandidateAnchorBenchmark } from "../candidate-anchor/benchmark.ts";
import { runCandidateAnchorBenchmark } from "../candidate-anchor/run.ts";
import { extractRelationAwareCandidates } from "./extract.ts";

describe("relation group PoC", () => {
  test("兄弟statementのrelationを判定して包含statementへ位置特定できる", async () => {
    const projectRoot = resolve(import.meta.dir, "../../../..");
    const benchmark = await loadCandidateAnchorBenchmark(
      resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
    );
    const selected = {
      ...benchmark,
      cases: benchmark.cases.filter(
        (benchmarkCase) => benchmarkCase.name === "describe全体の反復を指す",
      ),
      rules: benchmark.rules.filter(
        (rule) => rule.id === "table-driven-cases",
      ),
    };

    const result = await runCandidateAnchorBenchmark({
      benchmark: selected,
      provider: new RelationGroupStubProvider(),
      maxDecisionsPerRequest: 64,
      extractCandidates: extractRelationAwareCandidates,
    });

    expect(result.cases[0]?.exact).toBe(true);
    expect(result.cases[0]?.decisions).toContainEqual(
      expect.objectContaining({
        stage: "classification",
        symbol: "siblings(Block:2)",
        decision: "violation",
      }),
    );
    expect(result.cases[0]?.decisions).toContainEqual(
      expect.objectContaining({
        stage: "localization",
        symbol: "siblings(Block:2):enclosing-statement",
        decision: "violation",
      }),
    );
  });
});

class RelationGroupStubProvider implements SemanticDecisionProvider {
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
        ? subject.symbol === "siblings(Block:2):enclosing-statement"
        : subject.symbol === "siblings(Block:2)" &&
          subject.source.includes('test("1を変換できること"') &&
          subject.source.includes('test("2を変換できること"');
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

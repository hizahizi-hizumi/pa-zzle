import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../../domain/model.ts";
import { loadSelectorFirstBenchmark } from "./benchmark.ts";
import { runSelectorFirstBenchmark } from "./run.ts";

describe("runSelectorFirstBenchmark", () => {
  test("selectorで絞ったcandidateをstatement anchorへ位置特定する", async () => {
    const benchmark = await loadBenchmark();
    const selected = {
      ...benchmark,
      cases: benchmark.cases.filter(
        (item) => item.name === "Arrangeを1件だけ指す",
      ),
      rules: benchmark.rules.filter(
        (rule) => rule.id === "arrange-outside-test",
      ),
    };

    const result = await runSelectorFirstBenchmark({
      benchmark: selected,
      provider: new StubProvider({ arrangeSelector: true }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.selectors[0]?.selected).toEqual(["variable-declaration"]);
    expect(result.cases[0]?.selectorCoveredFindings).toBe(1);
    expect(result.cases[0]?.exact).toBe(true);
    expect(result.cases[0]?.findings[0]?.range).toEqual({
      startLine: 3,
      startColumn: 5,
      endLine: 3,
      endColumn: 30,
    });
  });

  test("selectorが対象種別を落とした時点のfalse negativeを計測する", async () => {
    const benchmark = await loadBenchmark();
    const selected = {
      ...benchmark,
      cases: benchmark.cases.filter(
        (item) => item.name === "describe全体の反復を指す",
      ),
      rules: benchmark.rules.filter(
        (rule) => rule.id === "table-driven-cases",
      ),
    };

    const result = await runSelectorFirstBenchmark({
      benchmark: selected,
      provider: new StubProvider({ arrangeSelector: false }),
      maxDecisionsPerRequest: 64,
    });

    expect(result.selectors[0]?.selected).toEqual([]);
    expect(result.cases[0]?.selectorCoveredFindings).toBe(0);
    expect(result.cases[0]?.actualFindings).toBe(0);
    expect(result.cases[0]?.exact).toBe(false);
  });
});

async function loadBenchmark() {
  const projectRoot = resolve(import.meta.dir, "../../../..");
  return loadSelectorFirstBenchmark(
    resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
  );
}

class StubProvider implements SemanticDecisionProvider {
  constructor(private readonly options: { arrangeSelector: boolean }) {}

  async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
    const subjects = new Map(batch.subjects.map((subject) => [subject.id, subject]));
    const decisions: Record<string, DecisionResult> = {};

    for (const request of batch.requests) {
      const subject = subjects.get(request.subjectId);
      if (!subject) throw new Error(`subjectがありません: ${request.subjectId}`);

      let violation = false;
      if (request.ruleId.endsWith("/selector")) {
        violation =
          this.options.arrangeSelector && subject.symbol === "variable-declaration";
      } else if (request.ruleId.endsWith("/location")) {
        violation = subject.symbol === "variable(values):statement";
      } else {
        violation = subject.symbol === "variable(values)";
      }

      decisions[request.taskId] = decision(violation ? "violation" : "compliant");
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

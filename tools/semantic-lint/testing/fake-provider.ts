import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../domain/model.ts";

export type FakeDecision = DecisionResult | ((batch: DecisionBatch) => DecisionResult);

export class FakeDecisionProvider implements SemanticDecisionProvider {
  readonly requests: DecisionBatch[] = [];
  readonly #decisions: Record<string, FakeDecision>;

  constructor(decisions: Record<string, FakeDecision>) {
    this.#decisions = decisions;
  }

  async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
    this.requests.push(batch);
    const decisions: Record<string, DecisionResult> = {};

    for (const request of batch.requests) {
      const fake = this.#decisions[request.taskId];

      if (!fake) {
        throw new Error(`fake decisionがありません: ${request.taskId}`);
      }

      decisions[request.taskId] =
        typeof fake === "function" ? fake(batch) : fake;
    }

    return {
      provider: {
        kind: "fake",
        model: "deterministic",
      },
      decisions,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }
}

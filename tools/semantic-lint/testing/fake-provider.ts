import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  ProviderRequestIdentity,
  SemanticDecisionProvider,
} from "../domain/model.ts";

export type FakeDecision = DecisionResult | ((batch: DecisionBatch) => DecisionResult);

export class FakeDecisionProvider implements SemanticDecisionProvider {
  readonly requests: DecisionBatch[] = [];
  readonly requestIdentity: ProviderRequestIdentity;
  readonly #decisions: Record<string, FakeDecision>;

  constructor(
    decisions: Record<string, FakeDecision>,
    options: { model?: string } = {},
  ) {
    this.#decisions = decisions;
    this.requestIdentity = {
      kind: "fake",
      model: options.model ?? "deterministic",
      requestFormat: "fake/1",
    };
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
        kind: this.requestIdentity.kind,
        model: this.requestIdentity.model,
      },
      decisions,
      usage: {
        inputTokens: batch.requests.length * 100,
        outputTokens: batch.requests.length,
      },
    };
  }
}

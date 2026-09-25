import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  ProviderRequestIdentity,
  RequestEstimate,
  SemanticDecisionProvider,
} from "../domain/model.ts";
import { estimateTypeSafeRequest } from "../providers/typesafe/provider.ts";

export type FakeDecision = DecisionResult | ((batch: DecisionBatch) => DecisionResult);

export class FakeDecisionProvider implements SemanticDecisionProvider {
  readonly requests: DecisionBatch[] = [];
  readonly requestIdentity: ProviderRequestIdentity;
  readonly #decisions: Record<string, FakeDecision>;
  readonly #estimate: (batch: DecisionBatch) => RequestEstimate;

  constructor(
    decisions: Record<string, FakeDecision>,
    options: {
      model?: string;
      estimate?: (batch: DecisionBatch) => RequestEstimate;
    } = {},
  ) {
    this.#decisions = decisions;
    this.#estimate =
      options.estimate ??
      ((batch) => estimateTypeSafeRequest("fake", batch));
    this.requestIdentity = {
      kind: "fake",
      model: options.model ?? "deterministic",
      requestFormat: "fake/1",
    };
  }

  estimate(batch: DecisionBatch): RequestEstimate {
    return this.#estimate(batch);
  }

  async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
    this.requests.push(batch);
    const decisions: Record<string, DecisionResult> = {};
    const locations: Record<string, number[]> = {};

    for (const request of batch.requests) {
      const fake = this.#decisions[request.taskId];

      if (!fake) {
        throw new Error(`fake decisionがありません: ${request.taskId}`);
      }

      const { parts, ...result } =
        typeof fake === "function" ? fake(batch) : fake;

      if (request.locate) {
        locations[request.taskId] = parts ?? [];
      } else {
        decisions[request.taskId] = result;
      }
    }

    return {
      provider: {
        kind: this.requestIdentity.kind,
        model: this.requestIdentity.model,
      },
      decisions,
      locations,
      usage: {
        inputTokens: batch.requests.length * 100,
        outputTokens: batch.requests.length,
      },
    };
  }
}

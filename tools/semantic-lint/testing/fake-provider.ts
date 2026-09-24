import type {
  DecisionBatch,
  DecisionBatchResult,
  DecisionResult,
  SemanticDecisionProvider,
} from "../domain/model.ts";
import type {
  ChoiceAnswer,
  ChoiceProvider,
  ChoiceQuestion,
  ChoiceRequest,
  ChoiceResponse,
} from "../providers/choice.ts";

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

export type FakeChoice = (question: ChoiceQuestion) => ChoiceAnswer;

/** 質問文とcriteriaだけから回答を決める決定論的なchoice provider。 */
export class FakeChoiceProvider implements ChoiceProvider {
  readonly kind = "fake";
  readonly model = "deterministic";
  readonly requests: ChoiceRequest[] = [];
  readonly #answer: FakeChoice;

  constructor(answer: FakeChoice) {
    this.#answer = answer;
  }

  async ask(request: ChoiceRequest): Promise<ChoiceResponse> {
    this.requests.push(request);

    return {
      model: this.model,
      answers: Object.fromEntries(
        Object.entries(request.questions).map(([id, question]) => [
          id,
          this.#answer(question),
        ]),
      ),
      usage: { inputTokens: 10, outputTokens: 1 },
    };
  }
}

/** 1つの選択肢に確率を寄せた回答。残りは他の選択肢へ均等に配る。 */
export function choiceAnswer(
  question: ChoiceQuestion,
  weights: Record<string, number>,
): ChoiceAnswer {
  const keys = Object.keys(question.criteria);
  const assigned = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const others = keys.filter((key) => !(key in weights));
  const rest = others.length === 0 ? 0 : (1 - assigned) / others.length;
  const probabilities = Object.fromEntries(
    keys.map((key) => [key, weights[key] ?? rest]),
  );
  const choice = keys.reduce((best, key) =>
    (probabilities[key] ?? 0) > (probabilities[best] ?? 0) ? key : best,
  );

  return {
    choice,
    confidence: probabilities[choice] ?? 0,
    probabilities,
  };
}

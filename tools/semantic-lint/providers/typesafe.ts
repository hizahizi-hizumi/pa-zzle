import {
  DECISION_CHOICES,
  type ChoiceAnswer,
  type DecisionChoice,
  type DecisionProvider,
  type ProviderRequest,
  type ProviderResponse,
  type TypeSafeProviderConfig,
} from "../types.ts";

const API_URL = "https://api.typesafe.ai/v1/systemone";
const MAX_ATTEMPTS = 3;

export function createTypeSafeProvider(
  config: TypeSafeProviderConfig,
): DecisionProvider {
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} が設定されていません。`);
  }

  return {
    async evaluate(request: ProviderRequest): Promise<ProviderResponse> {
      const response = await requestWithRetry(apiKey, {
        model: config.model,
        state: request.state,
        questions: request.questions,
      });
      const body: unknown = await response.json();

      return parseResponse(body);
    },
  };
}

async function requestWithRetry(apiKey: string, body: unknown): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response;
    }

    const retryable = response.status === 429 || response.status >= 500;

    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      await Bun.sleep(250 * 2 ** attempt);
      continue;
    }

    const responseBody = await response.text();
    throw new Error(`TypeSafe APIエラー (${response.status}): ${responseBody}`);
  }

  throw new Error("TypeSafe APIへのリクエストに失敗しました。");
}

function parseResponse(value: unknown): ProviderResponse {
  if (!isRecord(value) || typeof value.model !== "string" || !isRecord(value.answers)) {
    throw new Error("TypeSafe APIレスポンスが不正です。");
  }

  const answers: Record<string, ChoiceAnswer> = {};

  for (const [key, answer] of Object.entries(value.answers)) {
    answers[key] = parseChoiceAnswer(key, answer);
  }

  const usage = isRecord(value.usage) ? value.usage : {};

  return {
    model: value.model,
    answers,
    usage: {
      inputTokens: numberOrZero(usage.input_tokens),
      outputTokens: numberOrZero(usage.output_tokens),
    },
  };
}

function parseChoiceAnswer(key: string, value: unknown): ChoiceAnswer {
  if (
    !isRecord(value) ||
    value.type !== "choice" ||
    !isDecisionChoice(value.choice) ||
    typeof value.confidence !== "number" ||
    !isRecord(value.probabilities)
  ) {
    throw new Error(`Choiceレスポンスが不正です: ${key}`);
  }

  const probabilityRecord = value.probabilities;
  const probabilities = Object.fromEntries(
    DECISION_CHOICES.map((choice) => {
      const probability = probabilityRecord[choice];

      if (typeof probability !== "number") {
        throw new Error(`Choice確率が不正です: ${key}.${choice}`);
      }

      return [choice, probability];
    }),
  ) as Record<DecisionChoice, number>;

  return {
    choice: value.choice,
    confidence: value.confidence,
    probabilities,
  };
}

function isDecisionChoice(value: unknown): value is DecisionChoice {
  return typeof value === "string" && DECISION_CHOICES.includes(value as DecisionChoice);
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

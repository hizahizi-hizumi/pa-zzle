import {
  DECISIONS,
  type Decision,
  type DecisionBatch,
  type DecisionBatchResult,
  type DecisionResult,
  type SemanticDecisionProvider,
} from "../../domain/model.ts";
import type { SemanticLintConfig } from "../../config/config.ts";
import type {
  ChoiceAnswer,
  ChoiceProvider,
  ChoiceRequest,
  ChoiceResponse,
} from "../choice.ts";

const API_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MAX_ATTEMPTS = 3;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type TypeSafeTrace = {
  requestBody: unknown;
  responseBody: unknown;
};

export function createTypeSafeProvider(
  config: SemanticLintConfig["provider"],
  options: {
    fetchImpl?: FetchLike;
    sleep?: (milliseconds: number) => Promise<void>;
    maxAttempts?: number;
    onTrace?: (trace: TypeSafeTrace) => void;
  } = {},
): SemanticDecisionProvider {
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} が設定されていません。`);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? Bun.sleep;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  return {
    async evaluate(batch: DecisionBatch): Promise<DecisionBatchResult> {
      const { body, questionToTask } = buildRequest(config.model, batch);
      const response = await requestWithRetry({
        apiKey,
        body,
        fetchImpl,
        sleep,
        maxAttempts,
      });
      const value: unknown = await response.json();
      options.onTrace?.({
        requestBody: body,
        responseBody: value,
      });

      return parseResponse(value, questionToTask);
    },
  };
}

/** 任意の選択肢を扱うchoice provider。unit方式の判定と位置特定で使う。 */
export function createTypeSafeChoiceProvider(
  config: SemanticLintConfig["provider"],
  options: {
    fetchImpl?: FetchLike;
    sleep?: (milliseconds: number) => Promise<void>;
    maxAttempts?: number;
    onTrace?: (trace: TypeSafeTrace) => void;
  } = {},
): ChoiceProvider {
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} が設定されていません。`);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? Bun.sleep;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  return {
    kind: "typesafe",
    model: config.model,
    async ask(request: ChoiceRequest): Promise<ChoiceResponse> {
      const body = buildChoiceRequestBody(config.model, request);
      const response = await requestWithRetry({
        apiKey,
        body,
        fetchImpl,
        sleep,
        maxAttempts,
      });
      const value: unknown = await response.json();
      options.onTrace?.({ requestBody: body, responseBody: value });

      return parseChoiceResponse(value, request);
    },
  };
}

export function buildChoiceRequestBody(
  model: string,
  request: ChoiceRequest,
): unknown {
  return {
    model,
    state: request.state,
    questions: Object.fromEntries(
      Object.entries(request.questions).map(([id, question]) => [
        id,
        {
          type: "choice",
          instructions: question.instructions,
          criteria: question.criteria,
        },
      ]),
    ),
  };
}

function parseChoiceResponse(
  value: unknown,
  request: ChoiceRequest,
): ChoiceResponse {
  if (
    !isRecord(value) ||
    typeof value.model !== "string" ||
    !isRecord(value.answers)
  ) {
    throw new Error("TypeSafe APIレスポンスが不正です。");
  }

  const answers: Record<string, ChoiceAnswer> = {};

  for (const [questionId, question] of Object.entries(request.questions)) {
    const answer = value.answers[questionId];
    const keys = Object.keys(question.criteria);

    if (
      !isRecord(answer) ||
      answer.type !== "choice" ||
      typeof answer.choice !== "string" ||
      !keys.includes(answer.choice) ||
      !isProbability(answer.confidence) ||
      !isRecord(answer.probabilities)
    ) {
      throw new Error(`Choiceレスポンスが不正です: ${questionId}`);
    }

    const probabilityRecord = answer.probabilities;
    answers[questionId] = {
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: Object.fromEntries(
        keys.map((key) => {
          const probability = probabilityRecord[key];
          return [key, isProbability(probability) ? probability : 0];
        }),
      ),
    };
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

export function buildRequest(
  model: string,
  batch: DecisionBatch,
): {
  body: unknown;
  questionToTask: Map<string, string>;
} {
  const subjectsById = new Map(
    batch.subjects.map((subject, index) => [
      subject.id,
      {
        key: "s" + index,
        subject,
      },
    ]),
  );
  const questionToTask = new Map<string, string>();
  const questions: Record<string, unknown> = {};

  for (const [index, request] of batch.requests.entries()) {
    const questionId = "q" + index;
    const subject = subjectsById.get(request.subjectId);

    if (!subject) {
      throw new Error(
        `DecisionBatchにsubjectがありません: ${request.subjectId}`,
      );
    }

    questionToTask.set(questionId, request.taskId);
    questions[questionId] = {
      type: "choice",
      instructions: [
        `Evaluate only state.subjects.${subject.key}.`,
        "Use state.file as surrounding context when needed.",
        "Do not classify another subject in the file.",
        "",
        request.predicate.instruction,
      ].join("\n"),
      criteria: request.predicate.outcomes,
    };
  }

  const subjects = Object.fromEntries(
    [...subjectsById.values()].map(({ key, subject }) => [
      key,
      {
        id: subject.id,
        scope: subject.scope,
        path: subject.path,
        range: subject.range,
        ...(subject.symbol === undefined ? {} : { symbol: subject.symbol }),
        source: subject.source,
      },
    ]),
  );

  return {
    body: {
      model,
      state: {
        file: batch.file,
        subjects,
      },
      questions,
    },
    questionToTask,
  };
}

async function requestWithRetry(options: {
  apiKey: string;
  body: unknown;
  fetchImpl: FetchLike;
  sleep: (milliseconds: number) => Promise<void>;
  maxAttempts: number;
}): Promise<Response> {
  const { apiKey, body, fetchImpl, sleep, maxAttempts } = options;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttemptsは1以上の整数で指定してください。");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchImpl(API_URL, {
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

    if (retryable && attempt < maxAttempts - 1) {
      await sleep(250 * 2 ** attempt);
      continue;
    }

    const responseBody = await response.text();
    throw new Error(
      `TypeSafe APIエラー (${response.status}): ${responseBody}`,
    );
  }

  throw new Error("TypeSafe APIへのリクエストに失敗しました。");
}

function parseResponse(
  value: unknown,
  questionToTask: Map<string, string>,
): DecisionBatchResult {
  if (
    !isRecord(value) ||
    typeof value.model !== "string" ||
    !isRecord(value.answers)
  ) {
    throw new Error("TypeSafe APIレスポンスが不正です。");
  }

  const decisions: Record<string, DecisionResult> = {};

  for (const [questionId, taskId] of questionToTask) {
    const answer = value.answers[questionId];

    if (answer === undefined) {
      throw new Error(`TypeSafe API回答がありません: ${questionId}`);
    }

    decisions[taskId] = parseChoiceAnswer(questionId, answer);
  }

  const usage = isRecord(value.usage) ? value.usage : {};

  return {
    provider: {
      kind: "typesafe",
      model: value.model,
    },
    decisions,
    usage: {
      inputTokens: numberOrZero(usage.input_tokens),
      outputTokens: numberOrZero(usage.output_tokens),
    },
  };
}

function parseChoiceAnswer(
  questionId: string,
  value: unknown,
): DecisionResult {
  if (
    !isRecord(value) ||
    value.type !== "choice" ||
    !isDecision(value.choice) ||
    !isProbability(value.confidence) ||
    !isRecord(value.probabilities)
  ) {
    throw new Error(`Choiceレスポンスが不正です: ${questionId}`);
  }

  const probabilityRecord = value.probabilities;

  if (!isRecord(probabilityRecord)) {
    throw new Error(`Choice確率が不正です: ${questionId}`);
  }

  const probabilities = Object.fromEntries(
    DECISIONS.map((decision) => {
      const probability = probabilityRecord[decision];

      if (!isProbability(probability)) {
        throw new Error(
          `Choice確率が不正です: ${questionId}.${decision}`,
        );
      }

      return [decision, probability];
    }),
  ) as Record<Decision, number>;

  return {
    decision: value.choice,
    confidence: value.confidence,
    probabilities,
  };
}

function isDecision(value: unknown): value is Decision {
  return (
    typeof value === "string" &&
    DECISIONS.includes(value as Decision)
  );
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

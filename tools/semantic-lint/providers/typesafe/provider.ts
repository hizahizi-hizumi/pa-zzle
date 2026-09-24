import {
  DECISIONS,
  type Decision,
  type DecisionBatch,
  type DecisionBatchResult,
  type DecisionResult,
  type ProviderRequestIdentity,
  type RequestEstimate,
  type RequestEstimator,
  type SemanticDecisionProvider,
} from "../../domain/model.ts";
import type { SemanticLintConfig } from "../../config/config.ts";
import {
  buildDecisionState,
  type DecisionState,
} from "../../units/layout.ts";

const API_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MAX_ATTEMPTS = 3;
/**
 * buildRequestが組み立てるprompt / request形式の版。
 * 判定キャッシュのkeyに含まれるため、送る内容を変えたら更新する。
 */
export const TYPESAFE_REQUEST_FORMAT = "systemone-choice/4";

/**
 * Jevの課金input tokenを見積もる係数。実測した請求から求めた近似値。
 * - requestBase: 1 requestごとの固定分
 * - questionBase / optionBase: 質問1つ・選択肢1つの枠。文面は英単語1語を約1 tokenとして加える
 * - stateCharsPerToken: JSONにしたstateの文字数あたり
 */
export const JEV_TOKEN_ESTIMATE = {
  requestBase: 261,
  questionBase: 8,
  optionBase: 15,
  stateCharsPerToken: 2.35,
} as const;

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
    requestIdentity: typeSafeRequestIdentity(config),
    estimate: (batch) => estimateTypeSafeRequest(config.model, batch),
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

export function typeSafeRequestIdentity(
  config: SemanticLintConfig["provider"],
): ProviderRequestIdentity {
  return {
    kind: "typesafe",
    model: config.model,
    requestFormat: TYPESAFE_REQUEST_FORMAT,
  };
}

/** API keyなしで使える、TypeSafe requestのinput token見積もり。 */
export function createTypeSafeRequestEstimator(
  config: SemanticLintConfig["provider"],
): RequestEstimator {
  return {
    estimate: (batch) => estimateTypeSafeRequest(config.model, batch),
  };
}

export function estimateTypeSafeRequest(
  model: string,
  batch: DecisionBatch,
): RequestEstimate {
  const { body } = buildRequest(model, batch);
  const state = Math.ceil(
    JSON.stringify(body.state).length / JEV_TOKEN_ESTIMATE.stateCharsPerToken,
  );
  const questions = Object.values(body.questions).map(
    (question) =>
      JEV_TOKEN_ESTIMATE.questionBase +
      countWords(question.instructions) +
      Object.values(question.criteria).reduce(
        (sum, description) =>
          sum + JEV_TOKEN_ESTIMATE.optionBase + countWords(description),
        0,
      ),
  );

  return {
    state,
    questions,
    total:
      JEV_TOKEN_ESTIMATE.requestBase +
      state +
      questions.reduce((sum, tokens) => sum + tokens, 0),
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<Decision, string>;
};

export function buildRequest(
  model: string,
  batch: DecisionBatch,
): {
  body: {
    model: string;
    state: DecisionState;
    questions: Record<string, ChoiceQuestion>;
  };
  questionToTask: Map<string, string>;
} {
  const { state, keys } = buildDecisionState(batch);
  const questionToTask = new Map<string, string>();
  const questions: Record<string, ChoiceQuestion> = {};

  for (const [index, request] of batch.requests.entries()) {
    const questionId = "q" + index;
    const subjectKey = keys.get(request.subjectId);

    if (subjectKey === undefined) {
      throw new Error(
        `DecisionBatchにsubjectがありません: ${request.subjectId}`,
      );
    }

    questionToTask.set(questionId, request.taskId);
    questions[questionId] = {
      type: "choice",
      instructions: [
        `Evaluate only state.subjects.${subjectKey}.`,
        "Use state.file as surrounding context when needed.",
        "Do not classify another subject in the file.",
        "",
        request.predicate.instruction,
      ].join("\n"),
      criteria: request.predicate.outcomes,
    };
  }

  return {
    body: {
      model,
      state,
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

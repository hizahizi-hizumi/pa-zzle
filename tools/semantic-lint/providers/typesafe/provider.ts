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
export const TYPESAFE_REQUEST_FORMAT = "systemone-verdict-parts/1";

/**
 * unitの判定の選択肢の説明。全ruleで共通にし、ruleごとの判定基準は質問文のruleに書く。
 * 選択肢は質問ごとに送るため、短く保つ。
 */
export const DECISION_CRITERIA: Record<Decision, string> = {
  violation: "The subject violates the rule.",
  no_violation: "The subject does not violate the rule.",
  cannot_judge: "The given code is not enough to judge.",
};

/**
 * Jevの課金input tokenを見積もる係数。golden benchmarkのrequestごとの実usageへの最小二乗fit。
 * - requestBase: 1 requestごとの固定分
 * - questionBase / optionBase: choiceの質問1つ・選択肢1つの枠
 * - noulBase: noulの質問1つの枠
 * - tokensPerWord: 質問文と選択肢の英単語1語あたり
 * - stateAsciiTokensPerChar / stateNonAsciiTokensPerChar: JSONにしたstateの1文字あたり。
 *   コードのASCII文字は約4文字で1 token、日本語などの非ASCII文字は1文字で約2 tokenになる。
 */
export const JEV_TOKEN_ESTIMATE = {
  requestBase: 316,
  questionBase: 8,
  noulBase: 23,
  optionBase: 25,
  tokensPerWord: 1.13,
  stateAsciiTokensPerChar: 0.25,
  stateNonAsciiTokensPerChar: 1.86,
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
  const { body, questionToTask } = buildRequest(model, batch);
  const state = estimateStateTokens(JSON.stringify(body.state));
  const taskIndex = new Map(
    batch.requests.map((request, index) => [request.taskId, index]),
  );
  const questions = batch.requests.map(() => 0);

  // partの質問は、そのpartを問うtaskの質問に含めて数える。
  for (const [questionId, question] of Object.entries(body.questions)) {
    const target = questionToTask.get(questionId);
    const index =
      target === undefined ? undefined : taskIndex.get(target.taskId);

    if (index === undefined) {
      continue;
    }

    questions[index] = (questions[index] ?? 0) + estimateQuestionTokens(question);
  }

  return {
    state,
    questions,
    total:
      JEV_TOKEN_ESTIMATE.requestBase +
      state +
      questions.reduce((sum, tokens) => sum + tokens, 0),
  };
}

function estimateQuestionTokens(question: Question): number {
  const criteria = question.type === "choice" ? Object.values(question.criteria) : [];

  return Math.ceil(
    (question.type === "choice"
      ? JEV_TOKEN_ESTIMATE.questionBase
      : JEV_TOKEN_ESTIMATE.noulBase) +
      JEV_TOKEN_ESTIMATE.optionBase * criteria.length +
      JEV_TOKEN_ESTIMATE.tokensPerWord *
        [question.instructions, ...criteria].reduce(
          (sum, text) => sum + countWords(text),
          0,
        ),
  );
}

function estimateStateTokens(json: string): number {
  let ascii = 0;
  let nonAscii = 0;

  for (const character of json) {
    if ((character.codePointAt(0) ?? 0) <= 0x7f) {
      ascii += 1;
    } else {
      nonAscii += 1;
    }
  }

  return Math.ceil(
    ascii * JEV_TOKEN_ESTIMATE.stateAsciiTokensPerChar +
      nonAscii * JEV_TOKEN_ESTIMATE.stateNonAsciiTokensPerChar,
  );
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

/** yes / noの質問。回答はyesの確率。 */
type NoulQuestion = {
  type: "noul";
  instructions: string;
};

type Question = ChoiceQuestion | NoulQuestion;

/** 質問の回答先。partはunitの `parts` の位置。 */
type QuestionTarget = {
  taskId: string;
  part?: number;
};

export type TypeSafeState = DecisionState & {
  /** partの目印の説明。partを問う質問があるときだけ載せる。 */
  parts?: string;
  /** 違反箇所の候補を問う質問が参照するruleの `instruction`。 */
  rules?: Record<string, string>;
};

/**
 * requestを組み立てる。
 *
 * - unitの判定: 違反 / 違反ではない / 判断できないの3択のchoice。選択肢の説明は全rule共通。
 * - `locate` のrequest: 違反と判定したunitの違反箇所の候補（part）ごとのnoul。
 *   stateではそのunitのpartを目印で囲み、質問が参照するruleの文面はstateに1回だけ載せる。
 */
export function buildRequest(
  model: string,
  batch: DecisionBatch,
): {
  body: {
    model: string;
    state: TypeSafeState;
    questions: Record<string, Question>;
  };
  questionToTask: Map<string, QuestionTarget>;
} {
  const unitsById = new Map(batch.units.map((unit) => [unit.id, unit]));
  const partUnitIds = batch.requests
    .filter((request) => request.locate)
    .map((request) => request.subjectId)
    .filter((id) => (unitsById.get(id)?.parts.length ?? 0) > 0);
  const { state, keys, partKeys } = buildDecisionState({
    ...batch,
    partUnitIds,
  });
  const questionToTask = new Map<string, QuestionTarget>();
  const questions: Record<string, Question> = {};
  const rules: Record<string, string> = {};
  const ruleKeys = new Map<string, string>();

  for (const [index, request] of batch.requests.entries()) {
    const questionId = "q" + index;
    const subjectKey = keys.get(request.subjectId);

    if (subjectKey === undefined) {
      throw new Error(
        `DecisionBatchにsubjectがありません: ${request.subjectId}`,
      );
    }

    if (!request.locate) {
      questionToTask.set(questionId, { taskId: request.taskId });
      questions[questionId] = {
        type: "choice",
        instructions: [
          `Judge only state.subjects.${subjectKey}, marked by its begin and end comments in state.file.source, against the rule. The rest of state.file is context.`,
          "",
          `Rule: ${request.instruction.trim()}`,
        ].join("\n"),
        criteria: DECISION_CRITERIA,
      };
      continue;
    }

    const refs = partKeys.get(request.subjectId) ?? [];

    if (refs.length === 0) {
      continue;
    }

    let ruleKey = ruleKeys.get(request.ruleId);

    if (ruleKey === undefined) {
      ruleKey = "r" + ruleKeys.size;
      ruleKeys.set(request.ruleId, ruleKey);
      rules[ruleKey] = request.instruction;
    }

    for (const [part, ref] of refs.entries()) {
      const partQuestionId = `${questionId}p${part}`;
      questionToTask.set(partQuestionId, { taskId: request.taskId, part });
      questions[partQuestionId] = {
        type: "noul",
        instructions: `Assume state.subjects.${subjectKey} violates state.rules.${ruleKey}. Is part ${ref} one of the places where it does?`,
      };
    }
  }

  const partMarkers = [renderPartMarker(batch.marker, "pN"), renderPartMarker(batch.marker, "/pN")];

  return {
    body: {
      model,
      state: {
        ...state,
        ...(ruleKeys.size === 0
          ? {}
          : {
              parts: `In state.file.source, ${partMarkers[0]} and ${partMarkers[1]} enclose part pN of the subject that contains them.`,
              rules,
            }),
      },
      questions,
    },
    questionToTask,
  };
}

function renderPartMarker(marker: string, ref: string): string {
  return marker.replace("{ref}", ref);
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
  questionToTask: Map<string, QuestionTarget>,
): DecisionBatchResult {
  if (
    !isRecord(value) ||
    typeof value.model !== "string" ||
    !isRecord(value.answers)
  ) {
    throw new Error("TypeSafe APIレスポンスが不正です。");
  }

  const decisions: Record<string, DecisionResult> = {};
  const locations: Record<string, number[]> = {};

  for (const [questionId, target] of questionToTask) {
    const answer = value.answers[questionId];

    if (answer === undefined) {
      throw new Error(`TypeSafe API回答がありません: ${questionId}`);
    }

    if (target.part === undefined) {
      decisions[target.taskId] = parseChoiceAnswer(questionId, answer);
      continue;
    }

    const probabilities = (locations[target.taskId] ??= []);
    probabilities[target.part] = parseNoulAnswer(questionId, answer);
  }

  const usage = isRecord(value.usage) ? value.usage : {};

  return {
    provider: {
      kind: "typesafe",
      model: value.model,
    },
    decisions,
    locations,
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

function parseNoulAnswer(questionId: string, value: unknown): number {
  if (!isRecord(value) || value.type !== "noul" || !isProbability(value.noul)) {
    throw new Error(`Noulレスポンスが不正です: ${questionId}`);
  }

  return value.noul;
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

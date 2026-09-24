import type { SemanticLintConfig } from "../../config/config.ts";
import {
  DECISIONS,
  type Decision,
  type DecisionBatch,
  type DecisionBatchResult,
  type DecisionResult,
  type SemanticDecisionProvider,
  type SubjectContext,
} from "../../domain/model.ts";

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

type SerializedSubjectContext = Omit<SubjectContext, "region"> & {
  regionId?: string;
};

type SerializedRegion = NonNullable<SubjectContext["region"]> & {
  id: string;
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

export function buildRequest(
  model: string,
  batch: DecisionBatch,
): {
  body: unknown;
  questionToTask: Map<string, string>;
} {
  const regionIds = new Map<string, string>();
  const regions: Record<string, SerializedRegion> = {};
  const subjectsById = new Map(
    batch.subjects.map((subject, index) => [
      subject.id,
      {
        key: "s" + index,
        subject,
        context: serializeSubjectContext(subject.context, regionIds, regions),
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
    const contextInstructions =
      batch.stateMode === "subjects-only"
        ? [
            "Use state.subjects.*.context as deterministic structural evidence.",
            "When the current subject context has regionId, resolve it in state.regions and use that shared local region as surrounding evidence.",
            "No full-file source is provided. Judge from the current subject, its structural context, and the rule criteria.",
            "If required evidence is absent, choose insufficient_context instead of inferring unseen code.",
          ]
        : [
            "Use state.subjects.*.context as deterministic structural evidence when available.",
            "When the current subject context has regionId, resolve it in state.regions and use that shared local region as surrounding evidence.",
            "Use state.file only as surrounding evidence to understand the target, including its containment and semantic role.",
          ];
    const propagationInstruction =
      batch.stateMode === "subjects-only"
        ? "A violation elsewhere in the available context does not make the current target a violation."
        : "A violation elsewhere in the file does not make the current target a violation.";

    questions[questionId] = {
      type: "choice",
      instructions: [
        `The only classification target is state.subjects.${subject.key}.`,
        "Evaluate the criteria against that target itself.",
        ...contextInstructions,
        "If the criteria describe a container, use its descendants or siblings as evidence about whether that container itself satisfies the criteria.",
        propagationInstruction,
        "Do not transfer a violation from an ancestor, descendant, or sibling to the current target unless the criteria explicitly define the target container itself as the violation.",
        "",
        request.predicate.instruction,
      ].join("\n"),
      criteria: request.predicate.outcomes,
    };
  }

  const subjects = Object.fromEntries(
    [...subjectsById.values()].map(({ key, subject, context }) => [
      key,
      {
        id: subject.id,
        scope: subject.scope,
        path: subject.path,
        range: subject.range,
        ...(subject.symbol === undefined ? {} : { symbol: subject.symbol }),
        source: subject.source,
        ...(context === undefined ? {} : { context }),
      },
    ]),
  );
  const sharedState = {
    subjects,
    ...(Object.keys(regions).length === 0 ? {} : { regions }),
  };
  const state =
    batch.stateMode === "subjects-only"
      ? sharedState
      : { file: batch.file, ...sharedState };

  return {
    body: {
      model,
      state,
      questions,
    },
    questionToTask,
  };
}

function serializeSubjectContext(
  context: SubjectContext | undefined,
  regionIds: Map<string, string>,
  regions: Record<string, SerializedRegion>,
): SerializedSubjectContext | undefined {
  if (context === undefined) {
    return undefined;
  }

  const { region, ...structuralContext } = context;

  if (region === undefined) {
    return structuralContext;
  }

  const regionKey = `${region.kind}\u0000${region.source}`;
  let regionId = regionIds.get(regionKey);

  if (regionId === undefined) {
    regionId = `r${regionIds.size}`;
    regionIds.set(regionKey, regionId);
    regions[regionId] = { id: regionId, ...region };
  }

  return {
    ...structuralContext,
    regionId,
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

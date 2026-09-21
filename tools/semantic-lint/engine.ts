import { mapConcurrent } from "./concurrency.ts";
import { locateSemanticUnits } from "./locations.ts";
import type {
  DecisionProvider,
  FileEvaluation,
  RuleConfig,
  RuleEvaluation,
  SemanticUnit,
  Target,
} from "./types.ts";

const MAX_LOCALIZATION_QUESTIONS = 64;

type EvaluateSourceOptions = {
  localizeFindings?: boolean;
};

type LocalizationTarget = {
  evaluation: RuleEvaluation;
  unit: SemanticUnit;
};

export async function evaluateTargets(
  targets: Target[],
  provider: DecisionProvider,
  concurrency: number,
): Promise<FileEvaluation[]> {
  return mapConcurrent(targets, concurrency, (target) =>
    evaluateTarget(target, provider),
  );
}

export async function evaluateSource(
  path: string,
  source: string,
  rules: RuleConfig[],
  provider: DecisionProvider,
  options: EvaluateSourceOptions = {},
): Promise<FileEvaluation> {
  const questionToRule = new Map(
    rules.map((rule, index) => ["q" + index, rule] as const),
  );

  const questions = Object.fromEntries(
    [...questionToRule.entries()].map(([questionId, rule]) => [
      questionId,
      {
        type: "choice" as const,
        instructions: rule.question.instructions,
        criteria: rule.question.criteria,
      },
    ]),
  );

  const startedAt = performance.now();
  const response = await provider.evaluate({
    state: {
      file: {
        path,
        source,
      },
    },
    questions,
  });
  let durationMs = performance.now() - startedAt;
  let requestCount = 1;
  let inputTokens = response.usage.inputTokens;
  let outputTokens = response.usage.outputTokens;

  const evaluations: RuleEvaluation[] = [];

  for (const [questionId, rule] of questionToRule) {
    const answer = response.answers[questionId];

    if (!answer) {
      throw new Error(path + ": " + rule.id + " の回答がありません。");
    }

    evaluations.push({ rule, answer, locations: [] });
  }

  if (options.localizeFindings) {
    const localization = await localizeFindings(
      path,
      source,
      evaluations,
      provider,
    );
    durationMs += localization.durationMs;
    requestCount += localization.requestCount;
    inputTokens += localization.inputTokens;
    outputTokens += localization.outputTokens;
  }

  return {
    path,
    model: response.model,
    durationMs,
    requestCount,
    evaluations,
    usage: {
      inputTokens,
      outputTokens,
    },
  };
}

async function evaluateTarget(
  target: Target,
  provider: DecisionProvider,
): Promise<FileEvaluation> {
  const source = await Bun.file(target.absolutePath).text();

  return evaluateSource(target.path, source, target.rules, provider, {
    localizeFindings: true,
  });
}

async function localizeFindings(
  path: string,
  source: string,
  evaluations: RuleEvaluation[],
  provider: DecisionProvider,
): Promise<{
  durationMs: number;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const targets: LocalizationTarget[] = [];

  for (const evaluation of evaluations) {
    if (!isFinding(evaluation) || evaluation.rule.scope === "file") {
      continue;
    }

    for (const unit of locateSemanticUnits(source, evaluation.rule)) {
      targets.push({ evaluation, unit });
    }
  }

  let durationMs = 0;
  let requestCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (
    let offset = 0;
    offset < targets.length;
    offset += MAX_LOCALIZATION_QUESTIONS
  ) {
    const batch = targets.slice(
      offset,
      offset + MAX_LOCALIZATION_QUESTIONS,
    );

    if (batch.length === 0) {
      continue;
    }

    const questions = Object.fromEntries(
      batch.map((target, index) => [
        "q" + index,
        {
          type: "choice" as const,
          instructions: localizationInstructions(
            target.evaluation.rule,
            "u" + index,
          ),
          criteria: target.evaluation.rule.question.criteria,
        },
      ]),
    );
    const units = Object.fromEntries(
      batch.map((target, index) => [
        "u" + index,
        {
          kind: target.unit.kind,
          symbol: target.unit.symbol,
          range: target.unit.range,
          source: target.unit.source,
        },
      ]),
    );

    const startedAt = performance.now();
    const response = await provider.evaluate({
      state: {
        file: {
          path,
          source,
        },
        units,
      },
      questions,
    });
    durationMs += performance.now() - startedAt;
    requestCount += 1;
    inputTokens += response.usage.inputTokens;
    outputTokens += response.usage.outputTokens;

    for (let index = 0; index < batch.length; index += 1) {
      const target = batch[index];
      const answer = response.answers["q" + index];

      if (!target || !answer) {
        throw new Error(path + ": localizationの回答がありません。");
      }

      if (
        answer.probabilities.violation <
        target.evaluation.rule.violationThreshold
      ) {
        continue;
      }

      target.evaluation.locations.push({
        kind: target.unit.kind,
        symbol: target.unit.symbol,
        range: target.unit.range,
        answer,
      });
    }
  }

  return {
    durationMs,
    requestCount,
    inputTokens,
    outputTokens,
  };
}

function localizationInstructions(
  rule: RuleConfig,
  unitId: string,
): string {
  return [
    "Localize an already detected semantic lint violation.",
    "Evaluate only state.units." + unitId + ".",
    "Use state.file.source only as surrounding context.",
    "Return violation only when this specific unit is itself a location of the rule violation.",
    "Do not return violation merely because another unit in the file violates the rule.",
    "",
    "Original rule instruction:",
    rule.question.instructions,
  ].join("\n");
}

function isFinding(evaluation: RuleEvaluation): boolean {
  return (
    evaluation.answer.probabilities.violation >=
    evaluation.rule.violationThreshold
  );
}

import { mapConcurrent } from "./concurrency.ts";
import type {
  DecisionProvider,
  FileEvaluation,
  RuleConfig,
  RuleEvaluation,
  Target,
} from "./types.ts";

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
  const durationMs = performance.now() - startedAt;

  const evaluations: RuleEvaluation[] = [];

  for (const [questionId, rule] of questionToRule) {
    const answer = response.answers[questionId];

    if (!answer) {
      throw new Error(path + ": " + rule.id + " の回答がありません。");
    }

    evaluations.push({ rule, answer });
  }

  return {
    path,
    model: response.model,
    durationMs,
    evaluations,
    usage: response.usage,
  };
}

async function evaluateTarget(
  target: Target,
  provider: DecisionProvider,
): Promise<FileEvaluation> {
  const source = await Bun.file(target.absolutePath).text();

  return evaluateSource(target.path, source, target.rules, provider);
}

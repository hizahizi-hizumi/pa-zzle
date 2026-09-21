import type {
  DecisionProvider,
  FileEvaluation,
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

async function evaluateTarget(
  target: Target,
  provider: DecisionProvider,
): Promise<FileEvaluation> {
  const source = await Bun.file(target.absolutePath).text();
  const questionToRule = new Map(
    target.rules.map((rule, index) => [`q${index}`, rule] as const),
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
        path: target.path,
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
      throw new Error(`${target.path}: ${rule.id} の回答がありません。`);
    }

    evaluations.push({ rule, answer });
  }

  return {
    path: target.path,
    model: response.model,
    durationMs,
    evaluations,
    usage: response.usage,
  };
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      const value = values[index];

      if (value === undefined) {
        return;
      }

      results[index] = await mapper(value);
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

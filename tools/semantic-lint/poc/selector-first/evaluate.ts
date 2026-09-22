import type {
  DecisionBatch,
  DecisionBatchResult,
  Predicate,
  SemanticDecisionProvider,
  SourceDocument,
  Subject,
} from "../../domain/model.ts";

export type BatchUsage = {
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
};

export type EvaluatedSubjects = {
  results: Map<string, DecisionBatchResult["decisions"][string]>;
  usage: BatchUsage;
};

export async function evaluateSubjects(options: {
  document: SourceDocument;
  subjects: Subject[];
  predicateForSubject: (subject: Subject) => Predicate;
  ruleId: string;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<EvaluatedSubjects> {
  const {
    document,
    subjects,
    predicateForSubject,
    ruleId,
    provider,
    maxDecisionsPerRequest,
  } = options;
  const results = new Map<string, DecisionBatchResult["decisions"][string]>();
  const usage: BatchUsage = {
    providerRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  for (let offset = 0; offset < subjects.length; offset += maxDecisionsPerRequest) {
    const batchSubjects = subjects.slice(offset, offset + maxDecisionsPerRequest);
    const batch: DecisionBatch = {
      id: `${document.path}#${ruleId}#${offset / maxDecisionsPerRequest}`,
      file: document,
      subjects: batchSubjects,
      requests: batchSubjects.map((subject) => ({
        taskId: `${ruleId}::${subject.id}`,
        ruleId,
        subjectId: subject.id,
        predicate: predicateForSubject(subject),
      })),
    };
    const response = await provider.evaluate(batch);
    usage.providerRequests += 1;
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    for (const subject of batchSubjects) {
      const result = response.decisions[`${ruleId}::${subject.id}`];
      if (!result) {
        throw new Error(`provider resultがありません: ${subject.id}`);
      }
      results.set(subject.id, result);
    }
  }

  return { results, usage };
}

export function addUsage(left: BatchUsage, right: BatchUsage): BatchUsage {
  return {
    providerRequests: left.providerRequests + right.providerRequests,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
}

export function emptyUsage(): BatchUsage {
  return { providerRequests: 0, inputTokens: 0, outputTokens: 0 };
}

import type {
  DecisionBatch,
  DecisionBatchResult,
  Finding,
  Predicate,
  SemanticDecisionProvider,
  SourceDocument,
  Subject,
} from "../../domain/model.ts";
import {
  compareFindingRanges,
  resolveExpectedFindingRanges,
} from "../../eval/findings.ts";
import type {
  BenchmarkCase,
  BenchmarkRule,
  CandidateAnchorBenchmark,
} from "./benchmark.ts";
import {
  type Candidate,
  type CandidateAnchor,
  extractCandidateAnchors,
} from "./extract.ts";

export type CandidateExtractor = (document: SourceDocument) => Candidate[];
export type CandidateExtractorResolver = (
  rule: BenchmarkRule,
) => CandidateExtractor;

export type CandidateAnchorDecision = {
  stage: "classification" | "localization";
  subjectId: string;
  symbol?: string;
  source: string;
  decision: DecisionBatchResult["decisions"][string]["decision"];
  confidence: number;
  probabilities: DecisionBatchResult["decisions"][string]["probabilities"];
};

export type CandidateAnchorCaseResult = {
  name: string;
  ruleId: string;
  candidateCount: number;
  anchorCount: number;
  classificationDecisions: number;
  localizationDecisions: number;
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
  expectedFindings: number;
  actualFindings: number;
  matchedFindings: number;
  coveredExpectedFindings: number;
  exact: boolean;
  findings: Finding[];
  decisions: CandidateAnchorDecision[];
};

export type CandidateAnchorBenchmarkResult = {
  cases: CandidateAnchorCaseResult[];
  metrics: {
    candidateCount: number;
    anchorCount: number;
    classificationDecisions: number;
    localizationDecisions: number;
    providerRequests: number;
    inputTokens: number;
    outputTokens: number;
    expectedFindings: number;
    actualFindings: number;
    matchedFindings: number;
    coveredExpectedFindings: number;
    exactCases: number;
  };
};

type BatchUsage = {
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
};

type EvaluatedSubject = {
  subjectId: string;
  result: DecisionBatchResult["decisions"][string];
};

export async function runCandidateAnchorBenchmark(options: {
  benchmark: CandidateAnchorBenchmark;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
  extractCandidates?: CandidateExtractor;
  extractCandidatesForRule?: CandidateExtractorResolver;
}): Promise<CandidateAnchorBenchmarkResult> {
  const {
    benchmark,
    provider,
    maxDecisionsPerRequest,
    extractCandidates = extractCandidateAnchors,
    extractCandidatesForRule,
  } = options;
  const rulesById = new Map(benchmark.rules.map((rule) => [rule.id, rule]));
  const results: CandidateAnchorCaseResult[] = [];

  for (const benchmarkCase of benchmark.cases) {
    const rule = rulesById.get(benchmarkCase.ruleId);

    if (!rule) {
      throw new Error(`benchmark ruleがありません: ${benchmarkCase.ruleId}`);
    }

    results.push(
      await runCandidateAnchorCase({
        benchmarkCase,
        benchmarkOrigin: benchmark.origin,
        rule,
        provider,
        maxDecisionsPerRequest,
        extractCandidates:
          extractCandidatesForRule?.(rule) ?? extractCandidates,
      }),
    );
  }

  return {
    cases: results,
    metrics: {
      candidateCount: sum(results, (result) => result.candidateCount),
      anchorCount: sum(results, (result) => result.anchorCount),
      classificationDecisions: sum(
        results,
        (result) => result.classificationDecisions,
      ),
      localizationDecisions: sum(
        results,
        (result) => result.localizationDecisions,
      ),
      providerRequests: sum(results, (result) => result.providerRequests),
      inputTokens: sum(results, (result) => result.inputTokens),
      outputTokens: sum(results, (result) => result.outputTokens),
      expectedFindings: sum(results, (result) => result.expectedFindings),
      actualFindings: sum(results, (result) => result.actualFindings),
      matchedFindings: sum(results, (result) => result.matchedFindings),
      coveredExpectedFindings: sum(
        results,
        (result) => result.coveredExpectedFindings,
      ),
      exactCases: results.filter((result) => result.exact).length,
    },
  };
}

async function runCandidateAnchorCase(options: {
  benchmarkCase: BenchmarkCase;
  benchmarkOrigin: string;
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
  extractCandidates: CandidateExtractor;
}): Promise<CandidateAnchorCaseResult> {
  const {
    benchmarkCase,
    benchmarkOrigin,
    rule,
    provider,
    maxDecisionsPerRequest,
    extractCandidates,
  } = options;
  const source = await Bun.file(benchmarkCase.fixturePath).text();
  const document = {
    path: benchmarkCase.fixturePath,
    source,
  } satisfies SourceDocument;
  const candidates = extractCandidates(document);
  const expectedRanges = resolveExpectedFindingRanges(
    source,
    benchmarkCase.expectedFindings,
  );
  const coveredExpectedFindings = expectedRanges.filter((expectedRange) =>
    candidates.some((candidate) =>
      candidate.anchors.some((anchor) =>
        rangesEqual(anchor.range, expectedRange),
      ),
    ),
  ).length;
  const classification = await evaluateCandidates({
    document,
    candidates,
    rule,
    provider,
    maxDecisionsPerRequest,
  });
  const violations = candidates.filter((candidate) => {
    const result = classification.results.get(candidate.id);
    return (
      result !== undefined &&
      result.probabilities.violation >= rule.violationThreshold
    );
  });
  const localization = await localizeViolations({
    document,
    candidates: violations,
    rule,
    provider,
    maxDecisionsPerRequest,
  });
  const findings = dedupeFindings(
    violations.flatMap((candidate) => {
      const anchor = localization.anchors.get(candidate.id);

      if (!anchor) {
        return [];
      }

      return [
        {
          ruleId: `poc/${rule.id}`,
          severity: "warning" as const,
          message: rule.title,
          path: document.path,
          range: anchor.range,
          source: {
            path: benchmarkOrigin,
            section: rule.id,
          },
        },
      ];
    }),
  );
  const comparison = compareFindingRanges(expectedRanges, findings);

  return {
    name: benchmarkCase.name,
    ruleId: rule.id,
    candidateCount: candidates.length,
    anchorCount: candidates.reduce(
      (total, candidate) => total + candidate.anchors.length,
      0,
    ),
    classificationDecisions: candidates.length,
    localizationDecisions: localization.decisions,
    providerRequests:
      classification.usage.providerRequests + localization.usage.providerRequests,
    inputTokens: classification.usage.inputTokens + localization.usage.inputTokens,
    outputTokens:
      classification.usage.outputTokens + localization.usage.outputTokens,
    expectedFindings: expectedRanges.length,
    actualFindings: findings.length,
    matchedFindings: comparison.matched,
    coveredExpectedFindings,
    exact: comparison.exact,
    findings,
    decisions: [...classification.decisions, ...localization.decisionDetails],
  };
}

async function evaluateCandidates(options: {
  document: SourceDocument;
  candidates: Candidate[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  results: Map<string, EvaluatedSubject["result"]>;
  usage: BatchUsage;
  decisions: CandidateAnchorDecision[];
}> {
  const { document, candidates, rule, provider, maxDecisionsPerRequest } = options;
  const subjects = candidates.map((candidate) => candidateSubject(document, candidate));

  const evaluated = await evaluateSubjects({
    document,
    subjects,
    predicateForSubject: () => rule.predicate,
    ruleId: `poc/${rule.id}`,
    provider,
    maxDecisionsPerRequest,
  });

  return {
    ...evaluated,
    decisions: decisionDetails("classification", subjects, evaluated.results),
  };
}

async function localizeViolations(options: {
  document: SourceDocument;
  candidates: Candidate[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  anchors: Map<string, CandidateAnchor>;
  decisions: number;
  usage: BatchUsage;
  decisionDetails: CandidateAnchorDecision[];
}> {
  const { document, candidates, rule, provider, maxDecisionsPerRequest } = options;
  const anchors = candidates.flatMap((candidate) =>
    candidate.anchors.map((anchor) => ({ candidate, anchor })),
  );
  const subjects = anchors.map(({ candidate, anchor }) =>
    anchorSubject(document, candidate, anchor),
  );
  const candidatesByAnchorId = new Map(
    anchors.map(({ candidate, anchor }) => [anchor.id, candidate]),
  );
  const evaluated = await evaluateSubjects({
    document,
    subjects,
    predicateForSubject: (subject) => {
      const candidate = candidatesByAnchorId.get(subject.id);

      if (!candidate) {
        throw new Error(`anchorのcandidateがありません: ${subject.id}`);
      }

      return localizationPredicate(rule, candidate, subject.id);
    },
    ruleId: `poc/${rule.id}/location`,
    provider,
    maxDecisionsPerRequest,
  });
  const selected = new Map<string, CandidateAnchor>();

  for (const candidate of candidates) {
    const ranked = candidate.anchors
      .map((anchor) => ({
        anchor,
        probability:
          evaluated.results.get(anchor.id)?.probabilities.violation ?? -1,
      }))
      .sort((left, right) => right.probability - left.probability);
    const best = ranked[0]?.anchor;

    if (best) {
      selected.set(candidate.id, best);
    }
  }

  return {
    anchors: selected,
    decisions: subjects.length,
    usage: evaluated.usage,
    decisionDetails: decisionDetails("localization", subjects, evaluated.results),
  };
}

async function evaluateSubjects(options: {
  document: SourceDocument;
  subjects: Subject[];
  predicateForSubject: (subject: Subject) => Predicate;
  ruleId: string;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  results: Map<string, EvaluatedSubject["result"]>;
  usage: BatchUsage;
}> {
  const {
    document,
    subjects,
    predicateForSubject,
    ruleId,
    provider,
    maxDecisionsPerRequest,
  } = options;
  const results = new Map<string, EvaluatedSubject["result"]>();
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

function candidateSubject(
  document: SourceDocument,
  candidate: Candidate,
): Subject {
  return {
    id: candidate.id,
    scope: `typescript.${candidate.kind}`,
    path: document.path,
    range: candidate.range,
    symbol: candidate.label,
    source: candidate.source,
    context: candidate.context,
  };
}

function anchorSubject(
  document: SourceDocument,
  candidate: Candidate,
  anchor: CandidateAnchor,
): Subject {
  return {
    id: anchor.id,
    scope: `anchor.${anchor.role}`,
    path: document.path,
    range: anchor.range,
    symbol: `${candidate.label}:${anchor.role}`,
    source: anchor.source,
    context: candidate.context,
  };
}

function localizationPredicate(
  rule: BenchmarkRule,
  candidate: Candidate,
  currentAnchorId: string,
): Predicate {
  const anchors = candidate.anchors
    .map(
      (anchor) =>
        `${anchor.id === currentAnchorId ? "*" : "-"} ${anchor.id} (${anchor.role}): ${JSON.stringify(anchor.source)}`,
    )
    .join("\n");

  return {
    instruction: [
      `Rule: ${rule.title}`,
      "このcandidateは既にsemantic lint違反と判定されている。",
      `Candidate: ${candidate.label}`,
      `Candidate source: ${JSON.stringify(candidate.source)}`,
      "以下のanchor候補のうち、先頭が*の現在anchorがprimary diagnostic locationとして最適か判定する。",
      "狭いほど良いのではなく、その箇所を直接変更・移動・renameすることで違反を解消できる最も具体的な構文範囲を選ぶ。",
      anchors,
    ].join("\n"),
    outcomes: {
      violation:
        "現在anchorがこの違反を修正する箇所として最も正確なprimary locationである。",
      compliant:
        "現在anchorは違反に関係するが、別のanchorの方がprimary locationとして正確である。",
      not_applicable:
        "現在anchorはこの違反のprimary locationとして関係しない。",
      insufficient_context:
        "file、candidate、anchor候補を見てもprimary locationとして適切か判断できない。",
    },
  };
}

function decisionDetails(
  stage: CandidateAnchorDecision["stage"],
  subjects: Subject[],
  results: Map<string, EvaluatedSubject["result"]>,
): CandidateAnchorDecision[] {
  return subjects.flatMap((subject) => {
    const result = results.get(subject.id);

    if (!result) {
      return [];
    }

    return [
      {
        stage,
        subjectId: subject.id,
        ...(subject.symbol === undefined ? {} : { symbol: subject.symbol }),
        source: subject.source,
        decision: result.decision,
        confidence: result.confidence,
        probabilities: result.probabilities,
      },
    ];
  });
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const byLocation = new Map<string, Finding>();

  for (const finding of findings) {
    const range = finding.range;
    const key = [
      finding.ruleId,
      finding.path,
      range.startLine,
      range.startColumn,
      range.endLine,
      range.endColumn,
    ].join(":");
    byLocation.set(key, finding);
  }

  return [...byLocation.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.range.startLine - right.range.startLine ||
      left.range.startColumn - right.range.startColumn,
  );
}

function sum<T>(values: T[], selector: (value: T) => number): number {
  return values.reduce((total, value) => total + selector(value), 0);
}

function rangesEqual(
  left: Finding["range"],
  right: Finding["range"],
): boolean {
  return (
    left.startLine === right.startLine &&
    left.startColumn === right.startColumn &&
    left.endLine === right.endLine &&
    left.endColumn === right.endColumn
  );
}

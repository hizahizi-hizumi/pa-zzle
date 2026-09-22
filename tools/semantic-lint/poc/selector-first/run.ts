import type {
  Finding,
  Predicate,
  SemanticDecisionProvider,
  SourceDocument,
  SourceRange,
  Subject,
} from "../../domain/model.ts";
import {
  compareFindingRanges,
  resolveExpectedFindingRanges,
} from "../../eval/findings.ts";
import type {
  BenchmarkCase,
  BenchmarkRule,
  SelectorFirstBenchmark,
} from "./benchmark.ts";
import {
  addUsage,
  emptyUsage,
  evaluateSubjects,
  type BatchUsage,
} from "./evaluate.ts";
import { inferSelectors, type InferredSelectors } from "./infer.ts";
import {
  type SelectorAnchor,
  type SelectorCandidate,
  type SelectorId,
  extractSelectedCandidates,
} from "./selectors.ts";

export type SelectorFirstCaseResult = {
  name: string;
  ruleId: string;
  selectedSelectors: SelectorId[];
  candidateCount: number;
  anchorCount: number;
  selectorCoveredFindings: number;
  expectedFindings: number;
  classificationDecisions: number;
  localizationDecisions: number;
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
  actualFindings: number;
  matchedFindings: number;
  exact: boolean;
  findings: Finding[];
};

export type SelectorFirstBenchmarkResult = {
  selectors: InferredSelectors[];
  cases: SelectorFirstCaseResult[];
  metrics: {
    selectorDecisions: number;
    candidateCount: number;
    anchorCount: number;
    selectorCoveredFindings: number;
    expectedFindings: number;
    classificationDecisions: number;
    localizationDecisions: number;
    providerRequests: number;
    inputTokens: number;
    outputTokens: number;
    actualFindings: number;
    matchedFindings: number;
    exactCases: number;
  };
};

export async function runSelectorFirstBenchmark(options: {
  benchmark: SelectorFirstBenchmark;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<SelectorFirstBenchmarkResult> {
  const { benchmark, provider, maxDecisionsPerRequest } = options;
  const selectors: InferredSelectors[] = [];
  const selectorsByRule = new Map<string, InferredSelectors>();
  let selectorUsage = emptyUsage();

  for (const rule of benchmark.rules) {
    const inferred = await inferSelectors({
      rule,
      provider,
      maxDecisionsPerRequest,
    });
    selectors.push(inferred);
    selectorsByRule.set(rule.id, inferred);
    selectorUsage = addUsage(selectorUsage, inferred.usage);
  }

  const rulesById = new Map(benchmark.rules.map((rule) => [rule.id, rule]));
  const cases: SelectorFirstCaseResult[] = [];

  for (const benchmarkCase of benchmark.cases) {
    const rule = rulesById.get(benchmarkCase.ruleId);
    const inferred = selectorsByRule.get(benchmarkCase.ruleId);

    if (!rule || !inferred) {
      throw new Error(`benchmark ruleがありません: ${benchmarkCase.ruleId}`);
    }

    cases.push(
      await runSelectorFirstCase({
        benchmarkCase,
        benchmarkOrigin: benchmark.origin,
        rule,
        selectedSelectors: inferred.selected,
        provider,
        maxDecisionsPerRequest,
      }),
    );
  }

  const caseUsage = cases.reduce(
    (usage, item) =>
      addUsage(usage, {
        providerRequests: item.providerRequests,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
      }),
    emptyUsage(),
  );
  const totalUsage = addUsage(selectorUsage, caseUsage);

  return {
    selectors,
    cases,
    metrics: {
      selectorDecisions: sum(selectors, (item) => item.decisions),
      candidateCount: sum(cases, (item) => item.candidateCount),
      anchorCount: sum(cases, (item) => item.anchorCount),
      selectorCoveredFindings: sum(cases, (item) => item.selectorCoveredFindings),
      expectedFindings: sum(cases, (item) => item.expectedFindings),
      classificationDecisions: sum(cases, (item) => item.classificationDecisions),
      localizationDecisions: sum(cases, (item) => item.localizationDecisions),
      providerRequests: totalUsage.providerRequests,
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      actualFindings: sum(cases, (item) => item.actualFindings),
      matchedFindings: sum(cases, (item) => item.matchedFindings),
      exactCases: cases.filter((item) => item.exact).length,
    },
  };
}

async function runSelectorFirstCase(options: {
  benchmarkCase: BenchmarkCase;
  benchmarkOrigin: string;
  rule: BenchmarkRule;
  selectedSelectors: SelectorId[];
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<SelectorFirstCaseResult> {
  const {
    benchmarkCase,
    benchmarkOrigin,
    rule,
    selectedSelectors,
    provider,
    maxDecisionsPerRequest,
  } = options;
  const source = await Bun.file(benchmarkCase.fixturePath).text();
  const document = { path: benchmarkCase.fixturePath, source } satisfies SourceDocument;
  const candidates = extractSelectedCandidates(document, new Set(selectedSelectors));
  const expectedRanges = resolveExpectedFindingRanges(
    source,
    benchmarkCase.expectedFindings,
  );
  const selectorCoveredFindings = countCoveredRanges(expectedRanges, candidates);
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
      if (!anchor) return [];
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
    selectedSelectors,
    candidateCount: candidates.length,
    anchorCount: candidates.reduce(
      (total, candidate) => total + candidate.anchors.length,
      0,
    ),
    selectorCoveredFindings,
    expectedFindings: expectedRanges.length,
    classificationDecisions: candidates.length,
    localizationDecisions: localization.decisions,
    providerRequests:
      classification.usage.providerRequests + localization.usage.providerRequests,
    inputTokens: classification.usage.inputTokens + localization.usage.inputTokens,
    outputTokens: classification.usage.outputTokens + localization.usage.outputTokens,
    actualFindings: findings.length,
    matchedFindings: comparison.matched,
    exact: comparison.exact,
    findings,
  };
}

async function evaluateCandidates(options: {
  document: SourceDocument;
  candidates: SelectorCandidate[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<Awaited<ReturnType<typeof evaluateSubjects>>> {
  const { document, candidates, rule, provider, maxDecisionsPerRequest } = options;
  const subjects = candidates.map((candidate) => candidateSubject(document, candidate));

  return evaluateSubjects({
    document,
    subjects,
    predicateForSubject: () => rule.predicate,
    ruleId: `poc/${rule.id}`,
    provider,
    maxDecisionsPerRequest,
  });
}

async function localizeViolations(options: {
  document: SourceDocument;
  candidates: SelectorCandidate[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  anchors: Map<string, SelectorAnchor>;
  decisions: number;
  usage: BatchUsage;
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
      if (!candidate) throw new Error(`anchorのcandidateがありません: ${subject.id}`);
      return localizationPredicate(rule, candidate, subject.id);
    },
    ruleId: `poc/${rule.id}/location`,
    provider,
    maxDecisionsPerRequest,
  });
  const selected = new Map<string, SelectorAnchor>();

  for (const candidate of candidates) {
    const best = candidate.anchors
      .map((anchor) => ({
        anchor,
        probability: evaluated.results.get(anchor.id)?.probabilities.violation ?? -1,
      }))
      .sort((left, right) => right.probability - left.probability)[0]?.anchor;
    if (best) selected.set(candidate.id, best);
  }

  return { anchors: selected, decisions: subjects.length, usage: evaluated.usage };
}

function candidateSubject(
  document: SourceDocument,
  candidate: SelectorCandidate,
): Subject {
  return {
    id: candidate.id,
    scope: `selector.${candidate.selectorId}`,
    path: document.path,
    range: candidate.range,
    symbol: candidate.label,
    source: candidate.source,
  };
}

function anchorSubject(
  document: SourceDocument,
  candidate: SelectorCandidate,
  anchor: SelectorAnchor,
): Subject {
  return {
    id: anchor.id,
    scope: `anchor.${anchor.role}`,
    path: document.path,
    range: anchor.range,
    symbol: `${candidate.label}:${anchor.role}`,
    source: anchor.source,
  };
}

function localizationPredicate(
  rule: BenchmarkRule,
  candidate: SelectorCandidate,
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
      "その箇所を直接変更・移動・renameすることで違反を解消できる最も具体的な構文範囲を選ぶ。",
      anchors,
    ].join("\n"),
    outcomes: {
      violation: "現在anchorがこの違反を修正するprimary locationとして最も正確である。",
      compliant: "現在anchorより別のanchorの方がprimary locationとして正確である。",
      not_applicable: "現在anchorはこの違反のprimary locationとして関係しない。",
      insufficient_context: "candidateとanchor候補を見てもprimary locationを判断できない。",
    },
  };
}

function countCoveredRanges(
  expectedRanges: SourceRange[],
  candidates: SelectorCandidate[],
): number {
  const available = new Set(
    candidates.flatMap((candidate) => candidate.anchors.map((anchor) => rangeKey(anchor.range))),
  );
  return expectedRanges.filter((range) => available.has(rangeKey(range))).length;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const byLocation = new Map<string, Finding>();

  for (const finding of findings) {
    const key = `${finding.ruleId}:${finding.path}:${rangeKey(finding.range)}`;
    byLocation.set(key, finding);
  }

  return [...byLocation.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.range.startLine - right.range.startLine ||
      left.range.startColumn - right.range.startColumn,
  );
}

function rangeKey(range: SourceRange): string {
  return [
    range.startLine,
    range.startColumn,
    range.endLine,
    range.endColumn,
  ].join(":");
}

function sum<T>(values: T[], selector: (value: T) => number): number {
  return values.reduce((total, value) => total + selector(value), 0);
}

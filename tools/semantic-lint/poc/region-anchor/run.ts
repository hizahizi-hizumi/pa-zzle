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
  RegionAnchorBenchmark,
} from "./benchmark.ts";
import {
  emptyUsage,
  evaluateSubjects,
  type BatchUsage,
} from "./evaluate.ts";
import {
  extractLocationGroups,
  type LocationGroup,
  type RegionAnchor,
} from "./extract.ts";

export type RegionAnchorCaseResult = {
  name: string;
  ruleId: string;
  regionPassed: boolean;
  regionViolationProbability: number;
  regionGateCorrect: boolean;
  locationGroups: number;
  anchors: number;
  regionDecisions: number;
  localizationDecisions: number;
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
  expectedFindings: number;
  regionCoveredFindings: number;
  actualFindings: number;
  matchedFindings: number;
  exact: boolean;
  findings: Finding[];
};

export type RegionAnchorBenchmarkResult = {
  cases: RegionAnchorCaseResult[];
  metrics: {
    regionDecisions: number;
    localizationDecisions: number;
    providerRequests: number;
    inputTokens: number;
    outputTokens: number;
    expectedFindings: number;
    regionCoveredFindings: number;
    actualFindings: number;
    matchedFindings: number;
    exactCases: number;
    correctRegionGates: number;
  };
};

export async function runRegionAnchorBenchmark(options: {
  benchmark: RegionAnchorBenchmark;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<RegionAnchorBenchmarkResult> {
  const { benchmark, provider, maxDecisionsPerRequest } = options;
  const rulesById = new Map(benchmark.rules.map((rule) => [rule.id, rule]));
  const cases: RegionAnchorCaseResult[] = [];

  for (const benchmarkCase of benchmark.cases) {
    const rule = rulesById.get(benchmarkCase.ruleId);

    if (!rule) {
      throw new Error(`benchmark ruleがありません: ${benchmarkCase.ruleId}`);
    }

    cases.push(
      await runRegionAnchorCase({
        benchmarkCase,
        benchmarkOrigin: benchmark.origin,
        rule,
        provider,
        maxDecisionsPerRequest,
      }),
    );
  }

  return {
    cases,
    metrics: {
      regionDecisions: sum(cases, (item) => item.regionDecisions),
      localizationDecisions: sum(cases, (item) => item.localizationDecisions),
      providerRequests: sum(cases, (item) => item.providerRequests),
      inputTokens: sum(cases, (item) => item.inputTokens),
      outputTokens: sum(cases, (item) => item.outputTokens),
      expectedFindings: sum(cases, (item) => item.expectedFindings),
      regionCoveredFindings: sum(cases, (item) => item.regionCoveredFindings),
      actualFindings: sum(cases, (item) => item.actualFindings),
      matchedFindings: sum(cases, (item) => item.matchedFindings),
      exactCases: cases.filter((item) => item.exact).length,
      correctRegionGates: cases.filter((item) => item.regionGateCorrect).length,
    },
  };
}

async function runRegionAnchorCase(options: {
  benchmarkCase: BenchmarkCase;
  benchmarkOrigin: string;
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<RegionAnchorCaseResult> {
  const {
    benchmarkCase,
    benchmarkOrigin,
    rule,
    provider,
    maxDecisionsPerRequest,
  } = options;
  const source = await Bun.file(benchmarkCase.fixturePath).text();
  const document = {
    path: benchmarkCase.fixturePath,
    source,
  } satisfies SourceDocument;
  const groups = extractLocationGroups(document);
  const expectedRanges = resolveExpectedFindingRanges(
    source,
    benchmarkCase.expectedFindings,
  );
  const region = await evaluateRegion({
    document,
    rule,
    provider,
    maxDecisionsPerRequest,
  });
  const regionViolationProbability =
    region.results.get("region:file")?.probabilities.violation ?? 0;
  const regionPassed = regionViolationProbability >= rule.violationThreshold;
  const localization = regionPassed
    ? await localizeRegion({
        document,
        groups,
        rule,
        provider,
        maxDecisionsPerRequest,
      })
    : {
        anchors: new Map<string, RegionAnchor>(),
        decisions: 0,
        usage: emptyUsage(),
      };
  const findings = dedupeFindings(
    groups.flatMap((group) => {
      const anchor = localization.anchors.get(group.id);

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
  const expectsViolation = expectedRanges.length > 0;

  return {
    name: benchmarkCase.name,
    ruleId: rule.id,
    regionPassed,
    regionViolationProbability,
    regionGateCorrect: expectsViolation ? regionPassed : !regionPassed,
    locationGroups: groups.length,
    anchors: groups.reduce((total, group) => total + group.anchors.length, 0),
    regionDecisions: 1,
    localizationDecisions: localization.decisions,
    providerRequests:
      region.usage.providerRequests + localization.usage.providerRequests,
    inputTokens: region.usage.inputTokens + localization.usage.inputTokens,
    outputTokens: region.usage.outputTokens + localization.usage.outputTokens,
    expectedFindings: expectedRanges.length,
    regionCoveredFindings: regionPassed ? expectedRanges.length : 0,
    actualFindings: findings.length,
    matchedFindings: comparison.matched,
    exact: comparison.exact,
    findings,
  };
}

async function evaluateRegion(options: {
  document: SourceDocument;
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<Awaited<ReturnType<typeof evaluateSubjects>>> {
  const { document, rule, provider, maxDecisionsPerRequest } = options;
  const subject: Subject = {
    id: "region:file",
    scope: "region.file",
    path: document.path,
    range: fullFileRange(document.source),
    symbol: "file",
    source: document.source,
  };

  return evaluateSubjects({
    document,
    subjects: [subject],
    predicateForSubject: () => regionPredicate(rule),
    ruleId: `poc/${rule.id}/region`,
    provider,
    maxDecisionsPerRequest,
  });
}

async function localizeRegion(options: {
  document: SourceDocument;
  groups: LocationGroup[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  anchors: Map<string, RegionAnchor>;
  decisions: number;
  usage: BatchUsage;
}> {
  const { document, groups, rule, provider, maxDecisionsPerRequest } = options;
  const flattened = groups.flatMap((group) =>
    group.anchors.map((anchor) => ({ group, anchor })),
  );
  const subjects = flattened.map(({ group, anchor }) =>
    anchorSubject(document, group, anchor),
  );
  const groupByAnchorId = new Map(
    flattened.map(({ group, anchor }) => [anchor.id, group]),
  );
  const evaluated = await evaluateSubjects({
    document,
    subjects,
    predicateForSubject: (subject) => {
      const group = groupByAnchorId.get(subject.id);

      if (!group) {
        throw new Error(`anchorのlocation groupがありません: ${subject.id}`);
      }

      return localizationPredicate(rule, group, subject.id);
    },
    ruleId: `poc/${rule.id}/location`,
    provider,
    maxDecisionsPerRequest,
  });
  const selected = new Map<string, RegionAnchor>();

  for (const group of groups) {
    const best = group.anchors
      .map((anchor) => ({
        anchor,
        probability:
          evaluated.results.get(anchor.id)?.probabilities.violation ?? -1,
      }))
      .sort((left, right) => right.probability - left.probability)[0];

    if (best && best.probability >= rule.violationThreshold) {
      selected.set(group.id, best.anchor);
    }
  }

  return {
    anchors: selected,
    decisions: subjects.length,
    usage: evaluated.usage,
  };
}

function regionPredicate(rule: BenchmarkRule): Predicate {
  return {
    instruction: [
      `Rule: ${rule.title}`,
      rule.predicate.instruction,
      "判定対象はstate.file全体である。",
      "このfile内に上記ruleの具体的な違反が1件以上存在するかだけを判定する。",
      "この段階では違反箇所を選ばない。",
    ].join("\n"),
    outcomes: {
      violation: "file内にこのruleの違反が1件以上存在する。",
      compliant: "ruleを適用できるコードはあるが、file内に違反は存在しない。",
      not_applicable: "file内にこのruleを適用する意味のあるコードが存在しない。",
      insufficient_context: "file全体を見ても違反の有無を判断できない。",
    },
  };
}

function localizationPredicate(
  rule: BenchmarkRule,
  group: LocationGroup,
  currentAnchorId: string,
): Predicate {
  const anchors = group.anchors
    .map(
      (anchor) =>
        `${anchor.id === currentAnchorId ? "*" : "-"} ${anchor.id} (${anchor.role}): ${JSON.stringify(anchor.source)}`,
    )
    .join("\n");

  return {
    instruction: [
      `Rule: ${rule.title}`,
      rule.predicate.instruction,
      "state.fileにはこのruleの違反が1件以上存在すると既に判定されている。",
      `現在の構文グループ: ${group.label}`,
      `構文グループsource: ${JSON.stringify(group.source)}`,
      "以下のanchor候補のうち、先頭が*の現在anchorが、この構文グループに存在する具体的な違反のprimary diagnostic locationとして最適か判定する。",
      "この構文グループ自体が違反でなければviolationにしない。",
      "同じ違反について複数anchorをviolationにせず、その箇所を変更・移動・renameすることで直接解消できる最も具体的な構文範囲を選ぶ。",
      anchors,
    ].join("\n"),
    outcomes: {
      violation:
        "現在anchorが、この構文グループに存在する違反のprimary locationとして最も正確である。",
      compliant:
        "この構文グループはruleに関係するが違反ではない、または別anchorの方がprimary locationとして正確である。",
      not_applicable:
        "現在anchorと構文グループは、このruleの具体的な違反箇所ではない。",
      insufficient_context:
        "file全体とanchor候補を見てもprimary locationとして適切か判断できない。",
    },
  };
}

function anchorSubject(
  document: SourceDocument,
  group: LocationGroup,
  anchor: RegionAnchor,
): Subject {
  return {
    id: anchor.id,
    scope: `anchor.${anchor.role}`,
    path: document.path,
    range: anchor.range,
    symbol: `${group.label}:${anchor.role}`,
    source: anchor.source,
  };
}

function fullFileRange(source: string): SourceRange {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const endLine = Math.max(1, lines.length);
  const endColumn = (lines[endLine - 1] ?? "").length + 1;

  return {
    startLine: 1,
    startColumn: 1,
    endLine,
    endColumn,
  };
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

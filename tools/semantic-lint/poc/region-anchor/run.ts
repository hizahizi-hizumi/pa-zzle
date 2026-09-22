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
import {
  extractSemanticRegions,
  type SemanticRegion,
} from "./regions.ts";

export type RegionAnchorCaseResult = {
  name: string;
  ruleId: string;
  positiveRegions: string[];
  maxRegionViolationProbability: number;
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
  const regions = extractSemanticRegions(document, groups);
  const expectedRanges = resolveExpectedFindingRanges(
    source,
    benchmarkCase.expectedFindings,
  );
  const regionEvaluation = await evaluateRegions({
    document,
    regions,
    rule,
    provider,
    maxDecisionsPerRequest,
  });
  const positiveRegions = regions.filter(
    (region) =>
      regionEvaluation.results.get(region.id)?.decision === "violation",
  );
  const localization = positiveRegions.length > 0
    ? await localizeRegions({
        document,
        regions: positiveRegions,
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
  const regionCoveredFindings = countCoveredExpectedRanges(
    expectedRanges,
    positiveRegions,
  );
  const maxRegionViolationProbability = Math.max(
    0,
    ...regions.map(
      (region) =>
        regionEvaluation.results.get(region.id)?.probabilities.violation ?? 0,
    ),
  );
  const regionGateCorrect =
    expectedRanges.length === 0
      ? positiveRegions.length === 0
      : regionCoveredFindings === expectedRanges.length;

  return {
    name: benchmarkCase.name,
    ruleId: rule.id,
    positiveRegions: positiveRegions.map(
      (region) => `${region.kind}:${region.label}`,
    ),
    maxRegionViolationProbability,
    regionGateCorrect,
    locationGroups: groups.length,
    anchors: groups.reduce((total, group) => total + group.anchors.length, 0),
    regionDecisions: regions.length,
    localizationDecisions: localization.decisions,
    providerRequests:
      regionEvaluation.usage.providerRequests +
      localization.usage.providerRequests,
    inputTokens:
      regionEvaluation.usage.inputTokens + localization.usage.inputTokens,
    outputTokens:
      regionEvaluation.usage.outputTokens + localization.usage.outputTokens,
    expectedFindings: expectedRanges.length,
    regionCoveredFindings,
    actualFindings: findings.length,
    matchedFindings: comparison.matched,
    exact: comparison.exact,
    findings,
  };
}

async function evaluateRegions(options: {
  document: SourceDocument;
  regions: SemanticRegion[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<Awaited<ReturnType<typeof evaluateSubjects>>> {
  const { document, regions, rule, provider, maxDecisionsPerRequest } = options;
  const subjects = regions.map((region) => regionSubject(document, region));
  const regionsById = new Map(regions.map((region) => [region.id, region]));

  return evaluateSubjects({
    document,
    subjects,
    predicateForSubject: (subject) => {
      const region = regionsById.get(subject.id);

      if (!region) {
        throw new Error(`semantic regionがありません: ${subject.id}`);
      }

      return regionPredicate(rule, region);
    },
    ruleId: `poc/${rule.id}/region`,
    provider,
    maxDecisionsPerRequest,
  });
}

async function localizeRegions(options: {
  document: SourceDocument;
  regions: SemanticRegion[];
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<{
  anchors: Map<string, RegionAnchor>;
  decisions: number;
  usage: BatchUsage;
}> {
  const { document, regions, rule, provider, maxDecisionsPerRequest } = options;
  const flattened = regions.flatMap((region) =>
    region.groups.flatMap((group) =>
      group.anchors.map((anchor) => ({ region, group, anchor })),
    ),
  );
  const subjects = flattened.map(({ group, anchor }) =>
    anchorSubject(document, group, anchor),
  );
  const contextByAnchorId = new Map(
    flattened.map(({ region, group, anchor }) => [
      anchor.id,
      { region, group },
    ]),
  );
  const evaluated = await evaluateSubjects({
    document,
    subjects,
    predicateForSubject: (subject) => {
      const context = contextByAnchorId.get(subject.id);

      if (!context) {
        throw new Error(`anchor contextがありません: ${subject.id}`);
      }

      return localizationPredicate(
        rule,
        context.region,
        context.group,
        subject.id,
      );
    },
    ruleId: `poc/${rule.id}/location`,
    provider,
    maxDecisionsPerRequest,
  });
  const selected = new Map<string, RegionAnchor>();

  for (const { group } of flattened) {
    if (selected.has(group.id)) {
      continue;
    }

    const best = group.anchors
      .flatMap((anchor) => {
        const result = evaluated.results.get(anchor.id);

        return result?.decision === "violation"
          ? [{ anchor, probability: result.probabilities.violation }]
          : [];
      })
      .sort((left, right) => right.probability - left.probability)[0];

    if (best) {
      selected.set(group.id, best.anchor);
    }
  }

  return {
    anchors: selected,
    decisions: subjects.length,
    usage: evaluated.usage,
  };
}

function regionPredicate(
  rule: BenchmarkRule,
  region: SemanticRegion,
): Predicate {
  return {
    instruction: [
      `Rule: ${rule.title}`,
      `元ruleの判定指示: ${rule.predicate.instruction}`,
      `違反条件: ${rule.predicate.outcomes.violation}`,
      `現在のregion: ${region.kind} (${region.label})`,
      "判定対象はstate.subjects内の現在regionである。state.fileは周辺文脈としてだけ使う。",
      "現在region内に違反条件を満たす具体的なコード箇所が1件以上存在するか判定する。",
      "現在region外の違反だけを理由にviolationにしない。",
      "この段階では違反箇所を選ばない。",
    ].join("\n"),
    outcomes: {
      violation: "現在region内にこのruleの違反が1件以上存在する。",
      compliant:
        "ruleを適用できるコードはあるが、現在region内に違反は存在しない。",
      not_applicable:
        "現在region内にこのruleを適用する意味のあるコードが存在しない。",
      insufficient_context:
        "regionとfile周辺文脈を見ても違反の有無を判断できない。",
    },
  };
}

function localizationPredicate(
  rule: BenchmarkRule,
  region: SemanticRegion,
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
      `違反条件: ${rule.predicate.outcomes.violation}`,
      `positive region: ${region.kind} (${region.label})`,
      `現在の構文グループ: ${group.label}`,
      `構文グループsource: ${JSON.stringify(group.source)}`,
      "現在の構文グループがpositive region内の具体的な違反そのものか判定し、違反ならprimary diagnostic locationとして最適なanchorだけをviolationにする。",
      "positive region内に別の違反があるだけで、現在の構文グループ自体が違反でなければviolationにしない。",
      "同じ違反について複数anchorをviolationにしない。",
      anchors,
    ].join("\n"),
    outcomes: {
      violation:
        "現在anchorが、現在の構文グループに存在する違反のprimary locationとして最も正確である。",
      compliant:
        "現在の構文グループはruleに関係するが違反ではない、または別anchorの方がprimary locationとして正確である。",
      not_applicable:
        "現在anchorと構文グループは、このruleの具体的な違反箇所ではない。",
      insufficient_context:
        "regionとfile周辺文脈を見てもprimary locationとして適切か判断できない。",
    },
  };
}

function regionSubject(
  document: SourceDocument,
  region: SemanticRegion,
): Subject {
  return {
    id: region.id,
    scope: `region.${region.kind}`,
    path: document.path,
    range: region.range,
    symbol: region.label,
    source: region.source,
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

function countCoveredExpectedRanges(
  expectedRanges: SourceRange[],
  positiveRegions: SemanticRegion[],
): number {
  const available = new Set(
    positiveRegions.flatMap((region) =>
      region.groups.flatMap((group) =>
        group.anchors.map((anchor) => rangeKey(anchor.range)),
      ),
    ),
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

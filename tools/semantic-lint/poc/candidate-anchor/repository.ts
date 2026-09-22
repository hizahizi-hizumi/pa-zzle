import { resolve } from "node:path";

import type {
  DecisionStateMode,
  Finding,
  Rule,
  SemanticDecisionProvider,
} from "../../domain/model.ts";
import { discoverSourceDocuments } from "../../planning/discovery.ts";
import type {
  BenchmarkRule,
  CandidateAnchorBenchmark,
} from "./benchmark.ts";
import { runCandidateAnchorBenchmark } from "./run.ts";

export type RepositoryClassificationCandidate = {
  path: string;
  symbol?: string;
  source: string;
  decision: string;
  violationProbability: number;
};

export type CandidateAnchorRepositoryRuleResult = {
  ruleId: string;
  sourceRuleId: string;
  files: number;
  candidateCount: number;
  anchorCount: number;
  classificationDecisions: number;
  localizationDecisions: number;
  providerRequests: number;
  inputTokens: number;
  outputTokens: number;
  classificationCounts: Record<string, number>;
  topClassificationCandidates: RepositoryClassificationCandidate[];
  findings: Finding[];
};

export type CandidateAnchorRepositoryResult = {
  rules: CandidateAnchorRepositoryRuleResult[];
  skippedRuleIds: string[];
};

export async function runCandidateAnchorRepository(options: {
  projectRoot: string;
  benchmark: CandidateAnchorBenchmark;
  projectRules: Rule[];
  excludePaths: string[];
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
  stateMode?: DecisionStateMode;
}): Promise<CandidateAnchorRepositoryResult> {
  const {
    projectRoot,
    benchmark,
    projectRules,
    excludePaths,
    provider,
    maxDecisionsPerRequest,
    stateMode = "full-file",
  } = options;
  const results: CandidateAnchorRepositoryRuleResult[] = [];
  const skippedRuleIds: string[] = [];

  for (const benchmarkRule of benchmark.rules) {
    const sourceRule = findProjectRule(benchmarkRule, projectRules);

    if (!sourceRule) {
      skippedRuleIds.push(benchmarkRule.id);
      continue;
    }

    const documents = await discoverSourceDocuments({
      projectRoot,
      rules: [sourceRule],
      excludePaths,
      requestedPaths: [projectRoot],
      statuses: [sourceRule.status],
    });
    const repositoryBenchmark: CandidateAnchorBenchmark = {
      origin: benchmark.origin,
      rules: [benchmarkRule],
      cases: documents.map((document) => ({
        ruleId: benchmarkRule.id,
        name: document.path,
        fixturePath: resolve(projectRoot, document.path),
        expectedFindings: [],
      })),
    };
    const result = await runCandidateAnchorBenchmark({
      benchmark: repositoryBenchmark,
      provider,
      maxDecisionsPerRequest,
      stateMode,
    });

    const classificationCandidates = result.cases.flatMap((item) =>
      item.decisions
        .filter((decision) => decision.stage === "classification")
        .map((decision) => ({
          path: item.name,
          ...(decision.symbol === undefined ? {} : { symbol: decision.symbol }),
          source: decision.source,
          decision: decision.decision,
          violationProbability: decision.probabilities.violation,
        })),
    );
    const classificationCounts = Object.fromEntries(
      ["violation", "compliant", "not_applicable", "insufficient_context"].map(
        (decision) => [
          decision,
          classificationCandidates.filter((item) => item.decision === decision)
            .length,
        ],
      ),
    );

    results.push({
      ruleId: benchmarkRule.id,
      sourceRuleId: sourceRule.id,
      files: documents.length,
      candidateCount: result.metrics.candidateCount,
      anchorCount: result.metrics.anchorCount,
      classificationDecisions: result.metrics.classificationDecisions,
      localizationDecisions: result.metrics.localizationDecisions,
      providerRequests: result.metrics.providerRequests,
      inputTokens: result.metrics.inputTokens,
      outputTokens: result.metrics.outputTokens,
      classificationCounts,
      topClassificationCandidates: classificationCandidates
        .sort(
          (left, right) =>
            right.violationProbability - left.violationProbability,
        )
        .slice(0, 20),
      findings: result.cases.flatMap((item) => item.findings),
    });
  }

  return { rules: results, skippedRuleIds };
}

export function findProjectRule(
  benchmarkRule: BenchmarkRule,
  projectRules: Rule[],
): Rule | undefined {
  const suffix = `/${benchmarkRule.id}`;

  return projectRules.find(
    (rule) => rule.id === benchmarkRule.id || rule.id.endsWith(suffix),
  );
}

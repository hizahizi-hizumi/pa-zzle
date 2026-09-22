import { resolve } from "node:path";

import type {
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
}): Promise<CandidateAnchorRepositoryResult> {
  const {
    projectRoot,
    benchmark,
    projectRules,
    excludePaths,
    provider,
    maxDecisionsPerRequest,
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
    });

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

import { resolve } from "node:path";

import type { DecisionStateMode } from "../domain/model.ts";

import { discoverSourceDocuments } from "../planning/discovery.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { loadProjectContext } from "./context.ts";
import { loadCandidateAnchorBenchmark } from "../poc/candidate-anchor/benchmark.ts";
import { extractCandidateAnchors } from "../poc/candidate-anchor/extract.ts";
import { renderCandidateAnchorBenchmark } from "../poc/candidate-anchor/report.ts";
import {
  type CandidateExtractor,
  type CandidateExtractorResolver,
  runCandidateAnchorBenchmark,
} from "../poc/candidate-anchor/run.ts";
import {
  runCandidateAnchorRepository,
  type CandidateAnchorRepositoryResult,
} from "../poc/candidate-anchor/repository.ts";
import {
  extractRelationAwareCandidates,
  extractRelationGroupCandidates,
} from "../poc/relation-group/extract.ts";
import { extractTargetFamilyCandidates } from "../poc/target-family/extract.ts";

type PocStrategy = {
  title: string;
  extractor?: CandidateExtractor;
  extractorForRule?: CandidateExtractorResolver;
};

export async function runPocCommand(args: string[]): Promise<number> {
  const [strategy, ...strategyArgs] = args;
  const selected = strategyDefinition(strategy);

  return runCandidateAnchorPoc(strategyArgs, selected);
}

function strategyDefinition(strategy: string | undefined): PocStrategy {
  if (strategy === "candidate-anchor") {
    return {
      title: "Candidate + Anchor PoC",
      extractor: extractCandidateAnchors,
    };
  }

  if (strategy === "relation-group") {
    return {
      title: "Relation Group PoC",
      extractor: extractRelationAwareCandidates,
    };
  }

  if (strategy === "relation-group-only") {
    return {
      title: "Relation Group Only PoC",
      extractor: extractRelationGroupCandidates,
    };
  }

  if (strategy === "target-family") {
    return {
      title: "Target Family PoC",
      extractorForRule: (rule) => {
        const targetFamily = rule.targetFamily;

        if (targetFamily === undefined) {
          throw new Error(`target-familyが未指定です: ${rule.id}`);
        }

        return (document) => extractTargetFamilyCandidates(targetFamily, document);
      },
    };
  }

  throw new Error(
    "poc strategyはcandidate-anchor、relation-group、relation-group-only、target-familyのいずれかを指定してください。",
  );
}

async function runCandidateAnchorPoc(
  args: string[],
  strategy: PocStrategy,
): Promise<number> {
  const {
    planOnly,
    repeat,
    verbose,
    benchmarkPath,
    repository,
    maxDecisionsPerRequest,
    stateMode,
  } = parseCandidateAnchorOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const loadedBenchmark = await loadCandidateAnchorBenchmark(
    resolve(projectRoot, benchmarkPath),
  );
  const benchmark =
    stateMode === undefined
      ? loadedBenchmark
      : {
          ...loadedBenchmark,
          rules: loadedBenchmark.rules.map((rule) => ({ ...rule, stateMode })),
        };
  const decisionLimit =
    maxDecisionsPerRequest ?? config.execution.maxDecisionsPerRequest;

  if (planOnly) {
    const output = await renderCandidateAnchorPlan({
      projectRoot,
      benchmark,
      rules,
      excludePaths: config.excludePaths,
      maxDecisionsPerRequest: decisionLimit,
      ...(strategy.extractor === undefined
        ? {}
        : { extractCandidates: strategy.extractor }),
      ...(strategy.extractorForRule === undefined
        ? {}
        : { extractCandidatesForRule: strategy.extractorForRule }),
      title: strategy.title,
    });
    process.stdout.write(output);
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);

  if (repository) {
    if (repeat !== 1) {
      throw new Error("--repositoryでは--repeat 1のみ指定できます。");
    }

    const result = await runCandidateAnchorRepository({
      projectRoot,
      benchmark,
      projectRules: rules,
      excludePaths: config.excludePaths,
      provider,
      maxDecisionsPerRequest: decisionLimit,
      ...(strategy.extractor === undefined
        ? {}
        : { extractCandidates: strategy.extractor }),
      ...(strategy.extractorForRule === undefined
        ? {}
        : { extractCandidatesForRule: strategy.extractorForRule }),
    });
    process.stdout.write(
      renderCandidateAnchorRepository(projectRoot, result, strategy.title),
    );
    return 0;
  }

  for (let run = 1; run <= repeat; run += 1) {
    if (repeat > 1) {
      process.stdout.write(`run ${run}/${repeat}\n`);
    }

    const result = await runCandidateAnchorBenchmark({
      benchmark,
      provider,
      maxDecisionsPerRequest: decisionLimit,
      ...(strategy.extractor === undefined
        ? {}
        : { extractCandidates: strategy.extractor }),
      ...(strategy.extractorForRule === undefined
        ? {}
        : { extractCandidatesForRule: strategy.extractorForRule }),
    });
    process.stdout.write(
      renderCandidateAnchorBenchmark(result, {
        verbose,
        title: strategy.title,
      }),
    );
  }

  return 0;
}

function parseCandidateAnchorOptions(args: string[]): {
  planOnly: boolean;
  repeat: number;
  verbose: boolean;
  benchmarkPath: string;
  repository: boolean;
  maxDecisionsPerRequest?: number;
  stateMode?: DecisionStateMode;
} {
  let planOnly = false;
  let repeat = 1;
  let verbose = false;
  let benchmarkPath = ".semantic-lint/poc/benchmark.yaml";
  let repository = false;
  let maxDecisionsPerRequest: number | undefined;
  let stateMode: DecisionStateMode | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--plan-only") {
      planOnly = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--repository") {
      repository = true;
      continue;
    }

    if (arg === "--benchmark") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("--benchmarkにはbenchmark YAMLのpathを指定してください。");
      }

      benchmarkPath = value;
      index += 1;
      continue;
    }

    if (arg === "--repeat") {
      const value = Number(args[index + 1]);

      if (!Number.isInteger(value) || value < 1 || value > 10) {
        throw new Error("--repeatには1〜10の整数を指定してください。");
      }

      repeat = value;
      index += 1;
      continue;
    }

    if (arg === "--max-decisions-per-request") {
      const value = Number(args[index + 1]);

      if (!Number.isInteger(value) || value < 1 || value > 64) {
        throw new Error("--max-decisions-per-requestには1〜64の整数を指定してください。");
      }

      maxDecisionsPerRequest = value;
      index += 1;
      continue;
    }

    if (arg === "--state-mode") {
      const value = args[index + 1];

      if (value !== "full-file" && value !== "subjects-only") {
        throw new Error("--state-modeはfull-fileまたはsubjects-onlyを指定してください。");
      }

      stateMode = value;
      index += 1;
      continue;
    }

    throw new Error(`不明なcandidate-anchorオプションです: ${arg}`);
  }

  return {
    planOnly,
    repeat,
    verbose,
    benchmarkPath,
    repository,
    ...(maxDecisionsPerRequest === undefined ? {} : { maxDecisionsPerRequest }),
    ...(stateMode === undefined ? {} : { stateMode }),
  };
}

async function renderCandidateAnchorPlan(options: {
  projectRoot: string;
  benchmark: Awaited<ReturnType<typeof loadCandidateAnchorBenchmark>>;
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"];
  excludePaths: string[];
  maxDecisionsPerRequest: number;
  extractCandidates?: CandidateExtractor;
  extractCandidatesForRule?: CandidateExtractorResolver;
  title: string;
}): Promise<string> {
  const {
    projectRoot,
    benchmark,
    rules,
    excludePaths,
    maxDecisionsPerRequest,
    extractCandidates = extractCandidateAnchors,
    extractCandidatesForRule,
    title,
  } = options;
  const lines = [`${title} plan`, "", "benchmark"];
  let benchmarkCandidates = 0;
  let benchmarkAnchors = 0;

  const rulesById = new Map(benchmark.rules.map((rule) => [rule.id, rule]));

  for (const benchmarkCase of benchmark.cases) {
    const rule = rulesById.get(benchmarkCase.ruleId);

    if (!rule) {
      throw new Error(`benchmark ruleがありません: ${benchmarkCase.ruleId}`);
    }

    const source = await Bun.file(benchmarkCase.fixturePath).text();
    const extractor = extractCandidatesForRule?.(rule) ?? extractCandidates;
    const candidates = extractor({
      path: benchmarkCase.fixturePath,
      source,
    });
    const anchors = candidates.reduce(
      (total, candidate) => total + candidate.anchors.length,
      0,
    );
    benchmarkCandidates += candidates.length;
    benchmarkAnchors += anchors;
    lines.push(
      `  ${benchmarkCase.name}: candidates=${candidates.length} anchors=${anchors}`,
    );
  }

  lines.push(
    `  total: candidates=${benchmarkCandidates} anchors=${benchmarkAnchors}`,
    "",
    "repository",
  );

  const scopes = await createDefaultScopeRegistry(projectRoot);

  for (const benchmarkRule of benchmark.rules) {
    const sourceRule = rules.find(
      (rule) =>
        rule.id === benchmarkRule.id ||
        rule.id.endsWith(`/${benchmarkRule.id}`),
    );

    if (!sourceRule) {
      lines.push(`  ${benchmarkRule.id}: source rule not found`);
      continue;
    }

    const documents = await discoverSourceDocuments({
      projectRoot,
      rules: [sourceRule],
      excludePaths,
      requestedPaths: [projectRoot],
      statuses: [sourceRule.status],
    });
    const extractor =
      extractCandidatesForRule?.(benchmarkRule) ?? extractCandidates;
    let candidateCount = 0;
    let anchorCount = 0;
    let estimatedRequests = 0;
    let currentScopeSubjects = 0;
    let maxCandidates = 0;
    let maxCandidatePath = "";
    const kindCounts = new Map<string, number>();

    for (const document of documents) {
      const candidates = extractor(document);
      candidateCount += candidates.length;
      anchorCount += candidates.reduce(
        (total, candidate) => total + candidate.anchors.length,
        0,
      );
      estimatedRequests += Math.ceil(
        candidates.length / maxDecisionsPerRequest,
      );
      currentScopeSubjects += scopes.extract(sourceRule.scope, document).length;

      if (candidates.length > maxCandidates) {
        maxCandidates = candidates.length;
        maxCandidatePath = document.path;
      }

      for (const candidate of candidates) {
        kindCounts.set(
          candidate.kind,
          (kindCounts.get(candidate.kind) ?? 0) + 1,
        );
      }
    }

    lines.push(
      `  rule=${benchmarkRule.id}${benchmarkRule.targetFamily === undefined ? "" : ` targetFamily=${benchmarkRule.targetFamily}`}`,
      `    files=${documents.length}`,
      `    candidates=${candidateCount}`,
      `    anchors=${anchorCount}`,
      `    currentScopeSubjects=${currentScopeSubjects}`,
      `    estimatedClassificationRequests=${estimatedRequests}`,
      `    maxCandidatesPerFile=${maxCandidates} (${maxCandidatePath})`,
      "    kinds:",
      ...[...kindCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([kind, count]) => `      ${kind}=${count}`),
    );
  }

  return lines.join("\n") + "\n";
}

function renderCandidateAnchorRepository(
  projectRoot: string,
  result: CandidateAnchorRepositoryResult,
  title: string,
): string {
  const lines = [`${title} repository validation`, ""];

  for (const rule of result.rules) {
    lines.push(
      `rule=${rule.ruleId} sourceRule=${rule.sourceRuleId}`,
      `  files=${rule.files} findings=${rule.findings.length}`,
      `  candidates=${rule.candidateCount} anchors=${rule.anchorCount}`,
      `  classification=${rule.classificationDecisions} localization=${rule.localizationDecisions}`,
      `  requests=${rule.providerRequests} inputTokens=${rule.inputTokens} outputTokens=${rule.outputTokens}`,
      `  choices=${Object.entries(rule.classificationCounts)
        .map(([decision, count]) => `${decision}:${count}`)
        .join(",")}`,
      "  topClassificationCandidates:",
    );

    for (const candidate of rule.topClassificationCandidates) {
      lines.push(
        `    ${candidate.path} ${candidate.symbol ?? "unknown"} decision=${candidate.decision} violation=${(candidate.violationProbability * 100).toFixed(1)}% source=${JSON.stringify(candidate.source)}`,
      );
    }

    for (const finding of rule.findings) {
      const path = finding.path.startsWith(projectRoot)
        ? finding.path.slice(projectRoot.length + 1)
        : finding.path;
      lines.push(
        `  ${path}:${finding.range.startLine}:${finding.range.startColumn}-${finding.range.endLine}:${finding.range.endColumn} ${finding.message}`,
      );
    }

    lines.push("");
  }

  if (result.skippedRuleIds.length > 0) {
    lines.push(`skipped=${result.skippedRuleIds.join(",")}`, "");
  }

  return lines.join("\n");
}

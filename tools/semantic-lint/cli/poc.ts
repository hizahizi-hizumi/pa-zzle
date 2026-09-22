import { resolve } from "node:path";

import { discoverSourceDocuments } from "../planning/discovery.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { loadProjectContext } from "./context.ts";
import { loadCandidateAnchorBenchmark } from "../poc/candidate-anchor/benchmark.ts";
import { extractCandidateAnchors } from "../poc/candidate-anchor/extract.ts";
import { renderCandidateAnchorBenchmark } from "../poc/candidate-anchor/report.ts";
import { runCandidateAnchorBenchmark } from "../poc/candidate-anchor/run.ts";

export async function runPocCommand(args: string[]): Promise<number> {
  const [strategy, ...strategyArgs] = args;

  if (strategy !== "candidate-anchor") {
    throw new Error("poc strategyはcandidate-anchorを指定してください。");
  }

  return runCandidateAnchorPoc(strategyArgs);
}

async function runCandidateAnchorPoc(args: string[]): Promise<number> {
  const { planOnly, repeat, verbose, benchmarkPath } =
    parseCandidateAnchorOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const benchmark = await loadCandidateAnchorBenchmark(
    resolve(projectRoot, benchmarkPath),
  );

  if (planOnly) {
    const output = await renderCandidateAnchorPlan({
      projectRoot,
      benchmark,
      rules,
      excludePaths: config.excludePaths,
      maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
    });
    process.stdout.write(output);
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);

  for (let run = 1; run <= repeat; run += 1) {
    if (repeat > 1) {
      process.stdout.write(`run ${run}/${repeat}\n`);
    }

    const result = await runCandidateAnchorBenchmark({
      benchmark,
      provider,
      maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
    });
    process.stdout.write(renderCandidateAnchorBenchmark(result, { verbose }));
  }

  return 0;
}

function parseCandidateAnchorOptions(args: string[]): {
  planOnly: boolean;
  repeat: number;
  verbose: boolean;
  benchmarkPath: string;
} {
  let planOnly = false;
  let repeat = 1;
  let verbose = false;
  let benchmarkPath = ".semantic-lint/poc/benchmark.yaml";

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

    throw new Error(`不明なcandidate-anchorオプションです: ${arg}`);
  }

  return { planOnly, repeat, verbose, benchmarkPath };
}

async function renderCandidateAnchorPlan(options: {
  projectRoot: string;
  benchmark: Awaited<ReturnType<typeof loadCandidateAnchorBenchmark>>;
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"];
  excludePaths: string[];
  maxDecisionsPerRequest: number;
}): Promise<string> {
  const {
    projectRoot,
    benchmark,
    rules,
    excludePaths,
    maxDecisionsPerRequest,
  } = options;
  const lines = ["Candidate + Anchor PoC plan", "", "benchmark"];
  let benchmarkCandidates = 0;
  let benchmarkAnchors = 0;

  for (const benchmarkCase of benchmark.cases) {
    const source = await Bun.file(benchmarkCase.fixturePath).text();
    const candidates = extractCandidateAnchors({
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

  const arrangeRule = rules.find(
    (rule) => rule.id === "vitest/arrange-outside-test",
  );

  if (!arrangeRule) {
    throw new Error("vitest/arrange-outside-testがありません。");
  }

  const documents = await discoverSourceDocuments({
    projectRoot,
    rules: [arrangeRule],
    excludePaths,
    requestedPaths: [projectRoot],
    statuses: [arrangeRule.status],
  });
  const scopes = await createDefaultScopeRegistry(projectRoot);
  let candidateCount = 0;
  let anchorCount = 0;
  let estimatedRequests = 0;
  let currentScopeSubjects = 0;
  let maxCandidates = 0;
  let maxCandidatePath = "";
  const kindCounts = new Map<string, number>();

  for (const document of documents) {
    const candidates = extractCandidateAnchors(document);
    candidateCount += candidates.length;
    anchorCount += candidates.reduce(
      (total, candidate) => total + candidate.anchors.length,
      0,
    );
    estimatedRequests += Math.ceil(
      candidates.length / maxDecisionsPerRequest,
    );
    currentScopeSubjects += scopes.extract(arrangeRule.scope, document).length;

    if (candidates.length > maxCandidates) {
      maxCandidates = candidates.length;
      maxCandidatePath = document.path;
    }

    for (const candidate of candidates) {
      kindCounts.set(candidate.kind, (kindCounts.get(candidate.kind) ?? 0) + 1);
    }
  }

  lines.push(
    `  files=${documents.length}`,
    `  candidates=${candidateCount}`,
    `  anchors=${anchorCount}`,
    `  currentScopeSubjects=${currentScopeSubjects}`,
    `  estimatedClassificationRequests=${estimatedRequests}`,
    `  maxCandidatesPerFile=${maxCandidates} (${maxCandidatePath})`,
    "  kinds:",
    ...[...kindCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([kind, count]) => `    ${kind}=${count}`),
  );

  return lines.join("\n") + "\n";
}

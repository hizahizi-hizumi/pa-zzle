import { resolve } from "node:path";

import { discoverSourceDocuments } from "../planning/discovery.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import { loadProjectContext } from "./context.ts";
import { loadRegionAnchorBenchmark } from "../poc/region-anchor/benchmark.ts";
import { extractLocationGroups } from "../poc/region-anchor/extract.ts";
import { renderRegionAnchorBenchmark } from "../poc/region-anchor/report.ts";
import { runRegionAnchorBenchmark } from "../poc/region-anchor/run.ts";

export async function runPocCommand(args: string[]): Promise<number> {
  const [strategy, ...strategyArgs] = args;

  if (strategy !== "region-anchor") {
    throw new Error("poc strategyはregion-anchorを指定してください。");
  }

  return runRegionAnchorPoc(strategyArgs);
}

async function runRegionAnchorPoc(args: string[]): Promise<number> {
  const { planOnly, repeat } = parseRegionAnchorOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const benchmark = await loadRegionAnchorBenchmark(
    resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
  );

  if (planOnly) {
    process.stdout.write(
      await renderRegionAnchorPlan({
        projectRoot,
        rules,
        excludePaths: config.excludePaths,
        maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
      }),
    );
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);

  for (let run = 1; run <= repeat; run += 1) {
    if (repeat > 1) {
      process.stdout.write(`run ${run}/${repeat}\n`);
    }

    const result = await runRegionAnchorBenchmark({
      benchmark,
      provider,
      maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
    });
    process.stdout.write(renderRegionAnchorBenchmark(result));
  }

  return 0;
}

function parseRegionAnchorOptions(args: string[]): {
  planOnly: boolean;
  repeat: number;
} {
  let planOnly = false;
  let repeat = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--plan-only") {
      planOnly = true;
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

    throw new Error(`不明なregion-anchorオプションです: ${arg}`);
  }

  return { planOnly, repeat };
}

async function renderRegionAnchorPlan(options: {
  projectRoot: string;
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"];
  excludePaths: string[];
  maxDecisionsPerRequest: number;
}): Promise<string> {
  const arrangeRule = options.rules.find(
    (rule) => rule.id === "vitest/arrange-outside-test",
  );

  if (!arrangeRule) {
    throw new Error("vitest/arrange-outside-testがありません。");
  }

  const documents = await discoverSourceDocuments({
    projectRoot: options.projectRoot,
    rules: [arrangeRule],
    excludePaths: options.excludePaths,
    requestedPaths: [options.projectRoot],
    statuses: [arrangeRule.status],
  });
  let groups = 0;
  let anchors = 0;
  let allPositiveLocalizationRequests = 0;
  let maxAnchors = 0;
  let maxAnchorPath = "";

  for (const document of documents) {
    const documentGroups = extractLocationGroups(document);
    const documentAnchors = documentGroups.reduce(
      (total, group) => total + group.anchors.length,
      0,
    );
    groups += documentGroups.length;
    anchors += documentAnchors;
    allPositiveLocalizationRequests += Math.ceil(
      documentAnchors / options.maxDecisionsPerRequest,
    );

    if (documentAnchors > maxAnchors) {
      maxAnchors = documentAnchors;
      maxAnchorPath = document.path;
    }
  }

  return [
    "Region + Anchor PoC plan",
    "",
    `files=${documents.length}`,
    `locationGroups=${groups}`,
    `anchors=${anchors}`,
    `regionGateRequestsPerRule=${documents.length}`,
    `allPositiveLocalizationRequestsPerRule=${allPositiveLocalizationRequests}`,
    `allPositiveTotalRequestsPerRule=${documents.length + allPositiveLocalizationRequests}`,
    `maxAnchorsPerFile=${maxAnchors} (${maxAnchorPath})`,
    "",
  ].join("\n");
}

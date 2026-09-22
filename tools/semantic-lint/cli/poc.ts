import { resolve } from "node:path";

import { discoverSourceDocuments } from "../planning/discovery.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import { loadProjectContext } from "./context.ts";
import { loadSelectorFirstBenchmark } from "../poc/selector-first/benchmark.ts";
import { renderSelectorFirstBenchmark } from "../poc/selector-first/report.ts";
import { runSelectorFirstBenchmark } from "../poc/selector-first/run.ts";
import {
  SELECTOR_CATALOG,
  countCandidatesBySelector,
  extractSelectedCandidates,
  type SelectorId,
} from "../poc/selector-first/selectors.ts";

export async function runPocCommand(args: string[]): Promise<number> {
  const [strategy, ...strategyArgs] = args;

  if (strategy !== "selector-first") {
    throw new Error("poc strategyはselector-firstを指定してください。");
  }

  return runSelectorFirstPoc(strategyArgs);
}

async function runSelectorFirstPoc(args: string[]): Promise<number> {
  const { planOnly, repeat } = parseSelectorFirstOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const benchmark = await loadSelectorFirstBenchmark(
    resolve(projectRoot, ".semantic-lint/poc/benchmark.yaml"),
  );
  const repositoryDocuments = await loadTestDocuments({
    projectRoot,
    rules,
    excludePaths: config.excludePaths,
  });

  if (planOnly) {
    process.stdout.write(renderSelectorCatalogPlan(repositoryDocuments));
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);

  for (let run = 1; run <= repeat; run += 1) {
    if (repeat > 1) process.stdout.write(`run ${run}/${repeat}\n`);

    const result = await runSelectorFirstBenchmark({
      benchmark,
      provider,
      maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
    });
    process.stdout.write(renderSelectorFirstBenchmark(result));
    process.stdout.write(
      renderSelectedRepositoryPlan(
        result.selectors.map((item) => ({
          ruleId: item.ruleId,
          selected: item.selected,
        })),
        repositoryDocuments,
        config.execution.maxDecisionsPerRequest,
      ),
    );
  }

  return 0;
}

function parseSelectorFirstOptions(args: string[]): {
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

    throw new Error(`不明なselector-firstオプションです: ${arg}`);
  }

  return { planOnly, repeat };
}

async function loadTestDocuments(options: {
  projectRoot: string;
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"];
  excludePaths: string[];
}) {
  const arrangeRule = options.rules.find(
    (rule) => rule.id === "vitest/arrange-outside-test",
  );
  if (!arrangeRule) throw new Error("vitest/arrange-outside-testがありません。");

  return discoverSourceDocuments({
    projectRoot: options.projectRoot,
    rules: [arrangeRule],
    excludePaths: options.excludePaths,
    requestedPaths: [options.projectRoot],
    statuses: [arrangeRule.status],
  });
}

function renderSelectorCatalogPlan(
  documents: Awaited<ReturnType<typeof loadTestDocuments>>,
): string {
  const counts = new Map<SelectorId, number>();

  for (const document of documents) {
    for (const [selectorId, count] of countCandidatesBySelector(document)) {
      counts.set(selectorId, (counts.get(selectorId) ?? 0) + count);
    }
  }

  const lines = ["Selector-first PoC plan", "", `files=${documents.length}`, "catalog:"];
  for (const selector of SELECTOR_CATALOG) {
    lines.push(`  ${selector.id}=${counts.get(selector.id) ?? 0}`);
  }
  return lines.join("\n") + "\n";
}

function renderSelectedRepositoryPlan(
  selectors: Array<{ ruleId: string; selected: SelectorId[] }>,
  documents: Awaited<ReturnType<typeof loadTestDocuments>>,
  maxDecisionsPerRequest: number,
): string {
  const lines = ["repository selection"];

  for (const rule of selectors) {
    const selected = new Set(rule.selected);
    let candidates = 0;
    let requests = 0;
    let maxPerFile = 0;
    let maxPath = "";

    for (const document of documents) {
      const count = extractSelectedCandidates(document, selected).length;
      candidates += count;
      requests += Math.ceil(count / maxDecisionsPerRequest);
      if (count > maxPerFile) {
        maxPerFile = count;
        maxPath = document.path;
      }
    }

    lines.push(
      `  ${rule.ruleId}: selectors=${rule.selected.join(",") || "none"}`,
      `    candidates=${candidates} estimatedClassificationRequests=${requests}`,
      `    maxCandidatesPerFile=${maxPerFile}${maxPath ? ` (${maxPath})` : ""}`,
    );
  }

  return lines.join("\n") + "\n";
}

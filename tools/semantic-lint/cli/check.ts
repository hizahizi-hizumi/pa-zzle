import { readFile } from "node:fs/promises";

import { resolveRequestedPaths } from "../config/project.ts";
import type { RunResult } from "../domain/model.ts";
import { failsRun } from "../diagnostics/build.ts";
import { planRequests, runEvaluationPlan } from "../engine/run.ts";
import {
  renderRequestPlanSummary,
  summarizeRequestPlan,
} from "../planning/estimate.ts";
import { discoverSourceDocuments } from "../planning/discovery.ts";
import {
  buildEvaluationPlan,
  bunGlobPathMatcher,
} from "../planning/planner.ts";
import {
  createTypeSafeProvider,
  createTypeSafeRequestEstimator,
  typeSafeRequestIdentity,
} from "../providers/typesafe/provider.ts";
import {
  renderRunResult,
  type OutputFormat,
} from "../reporters/render.ts";
import { UnitExtractor } from "../units/extract.ts";
import { loadProjectContext } from "./context.ts";
import { closeDecisionCache, openDecisionCache } from "./decision-cache.ts";

type CheckOptions = {
  paths: string[];
  filesFrom?: string;
  format: OutputFormat;
  failOn: "error" | "warning";
  failOnUnknown: boolean;
  cache: boolean;
  planOnly: boolean;
};

export async function runCheckCommand(args: string[]): Promise<number> {
  const options = parseCheckOptions(args);
  const { projectRoot, config, catalog, rules } = await loadProjectContext();
  const requestedPaths = await resolveCheckPaths(
    projectRoot,
    options.paths,
    options.filesFrom,
  );
  const documents = await discoverSourceDocuments({
    projectRoot,
    rules,
    excludePaths: config.excludePaths,
    requestedPaths,
  });

  if (
    options.paths.length === 0 &&
    options.filesFrom === undefined &&
    rules.length > 0 &&
    documents.length === 0
  ) {
    throw new Error(
      "有効なruleはありますが、repository全体から対象ファイルを1件も検出できませんでした。ruleのpathsまたはsource discoveryを確認してください。",
    );
  }

  const extractor = await UnitExtractor.create(catalog);
  const plan = buildEvaluationPlan({
    documents,
    rules,
    extractor,
    matchesPath: bunGlobPathMatcher,
  });

  const plannedEvaluations = plan.files.reduce(
    (sum, file) => sum + file.tasks.length,
    0,
  );

  if (options.planOnly) {
    const cache = await openDecisionCache(projectRoot, options.cache);
    const estimator = createTypeSafeRequestEstimator(config.provider);
    const summary = summarizeRequestPlan({
      plan,
      planned: planRequests({
        plan,
        rules,
        requestIdentity: typeSafeRequestIdentity(config.provider),
        estimator,
        budget: config.execution.requestTokenBudget,
        ...(cache === undefined ? {} : { cache }),
      }),
      estimator,
      rules,
      matchesPath: bunGlobPathMatcher,
    });
    process.stdout.write(
      options.format === "json"
        ? JSON.stringify(summary, null, 2) + "\n"
        : renderRequestPlanSummary(summary),
    );
    return 0;
  }

  if (plannedEvaluations === 0) {
    const emptyResult = createEmptyRunResult(plan.files.length, options.cache);
    process.stdout.write(renderRunResult(emptyResult, options.format));
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);
  const cache = await openDecisionCache(projectRoot, options.cache);
  const result = await runEvaluationPlan({
    plan,
    rules,
    provider,
    concurrency: config.execution.concurrency,
    requestTokenBudget: config.execution.requestTokenBudget,
    ...(cache === undefined ? {} : { cache }),
  });
  await closeDecisionCache(cache);

  process.stdout.write(renderRunResult(result, options.format));
  return exitCodeForResult(result, options);
}

function parseCheckOptions(args: string[]): CheckOptions {
  const paths: string[] = [];
  let filesFrom: string | undefined;
  let format: OutputFormat = "pretty";
  let failOn: "error" | "warning" = "error";
  let failOnUnknown = false;
  let cache = true;
  let planOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--files-from": {
        const value = args[index + 1];

        if (!value) {
          throw new Error("--files-fromにはpathを指定してください。");
        }

        filesFrom = value;
        index += 1;
        break;
      }
      case "--format": {
        const value = args[index + 1];

        if (value !== "pretty" && value !== "compact" && value !== "json") {
          throw new Error("--formatはpretty / compact / jsonを指定してください。");
        }

        format = value;
        index += 1;
        break;
      }
      case "--fail-on": {
        const value = args[index + 1];

        if (value !== "error" && value !== "warning") {
          throw new Error("--fail-onはerror / warningを指定してください。");
        }

        failOn = value;
        index += 1;
        break;
      }
      case "--fail-on-unknown":
        failOnUnknown = true;
        break;
      case "--no-cache":
        cache = false;
        break;
      case "--plan-only":
        planOnly = true;
        break;
      default:
        if (arg?.startsWith("-")) {
          throw new Error(`不明なcheckオプションです: ${arg}`);
        }

        if (arg) {
          paths.push(arg);
        }
    }
  }

  return {
    paths,
    ...(filesFrom === undefined ? {} : { filesFrom }),
    format,
    failOn,
    failOnUnknown,
    cache,
    planOnly,
  };
}

async function resolveCheckPaths(
  projectRoot: string,
  paths: string[],
  filesFrom: string | undefined,
): Promise<string[]> {
  const explicit = paths.length > 0
    ? await resolveRequestedPaths(projectRoot, paths, projectRoot)
    : [];

  if (filesFrom === undefined) {
    return explicit.length > 0
      ? explicit
      : resolveRequestedPaths(projectRoot, ["."], projectRoot);
  }

  const fileList = await readFile(filesFrom, "utf8");
  const entries = fileList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const fromFile =
    entries.length === 0
      ? []
      : await resolveRequestedPaths(
          projectRoot,
          entries,
          projectRoot,
        );

  return [...new Set([...explicit, ...fromFile])];
}

function exitCodeForResult(
  result: RunResult,
  options: CheckOptions,
): number {
  if (options.failOnUnknown && result.unknowns.length > 0) {
    return 1;
  }

  return failsRun(result.diagnostics, options.failOn) ? 1 : 0;
}

function createEmptyRunResult(
  scannedFiles: number,
  cacheEnabled: boolean,
): RunResult {
  return {
    schemaVersion: 1,
    diagnostics: [],
    unknowns: [],
    evaluations: [],
    metrics: {
      scannedFiles,
      subjects: 0,
      plannedEvaluations: 0,
      providerRequests: 0,
      providerDecisions: 0,
      diagnostics: 0,
      unknowns: 0,
      inputTokens: 0,
      outputTokens: 0,
      cache: {
        enabled: cacheEnabled,
        hits: 0,
        misses: 0,
      },
      totalDurationMs: 0,
      providerLatencyMs: [],
    },
  };
}

export const _private = { parseCheckOptions, exitCodeForResult };

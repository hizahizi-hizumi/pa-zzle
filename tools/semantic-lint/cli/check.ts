import { readFile } from "node:fs/promises";

import { resolveRequestedPaths } from "../config/project.ts";
import type { RuleStatus, RunResult } from "../domain/model.ts";
import { runEvaluationPlan } from "../engine/run.ts";
import { discoverSourceDocuments } from "../planning/discovery.ts";
import {
  buildEvaluationPlan,
  bunGlobPathMatcher,
} from "../planning/planner.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import {
  renderRunResult,
  type OutputFormat,
} from "../reporters/render.ts";
import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { loadProjectContext } from "./context.ts";

type CheckOptions = {
  paths: string[];
  filesFrom?: string;
  format: OutputFormat;
  includeDraft: boolean;
  failOn: "error" | "warning";
  failOnUnknown: boolean;
};

export async function runCheckCommand(args: string[]): Promise<number> {
  const options = parseCheckOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const statuses: RuleStatus[] = options.includeDraft
    ? ["active", "draft"]
    : ["active"];
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
    statuses,
  });
  const scopes = await createDefaultScopeRegistry(projectRoot);
  const plan = buildEvaluationPlan({
    documents,
    rules,
    scopes,
    matchesPath: bunGlobPathMatcher,
    statuses,
  });

  if (plan.files.length === 0) {
    const emptyResult = createEmptyRunResult();
    process.stdout.write(renderRunResult(emptyResult, options.format));
    return 0;
  }

  const provider = createTypeSafeProvider(config.provider);
  const result = await runEvaluationPlan({
    plan,
    rules,
    provider,
    concurrency: config.execution.concurrency,
    maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
  });

  process.stdout.write(renderRunResult(result, options.format));
  return exitCodeForResult(result, options);
}

function parseCheckOptions(args: string[]): CheckOptions {
  const paths: string[] = [];
  let filesFrom: string | undefined;
  let format: OutputFormat = "pretty";
  let includeDraft = false;
  let failOn: "error" | "warning" = "error";
  let failOnUnknown = false;

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
      case "--include-draft":
        includeDraft = true;
        break;
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
    includeDraft,
    failOn,
    failOnUnknown,
  };
}

async function resolveCheckPaths(
  projectRoot: string,
  paths: string[],
  filesFrom: string | undefined,
): Promise<string[]> {
  const explicit = paths.length > 0
    ? await resolveRequestedPaths(projectRoot, paths)
    : [];

  if (filesFrom === undefined) {
    return explicit.length > 0
      ? explicit
      : resolveRequestedPaths(projectRoot, []);
  }

  const fileList = await readFile(filesFrom, "utf8");
  const entries = fileList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const fromFile = await resolveRequestedPaths(
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

  if (options.failOn === "warning") {
    return result.diagnostics.length > 0 ? 1 : 0;
  }

  return result.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  )
    ? 1
    : 0;
}

function createEmptyRunResult(): RunResult {
  return {
    schemaVersion: 1,
    diagnostics: [],
    unknowns: [],
    evaluations: [],
    metrics: {
      scannedFiles: 0,
      subjects: 0,
      plannedEvaluations: 0,
      providerRequests: 0,
      providerDecisions: 0,
      diagnostics: 0,
      unknowns: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalDurationMs: 0,
      providerLatencyMs: [],
    },
  };
}

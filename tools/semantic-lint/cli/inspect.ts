import { relative, resolve, sep } from "node:path";

import { buildDecisionBatches } from "../planning/batches.ts";
import {
  buildEvaluationPlan,
  bunGlobPathMatcher,
} from "../planning/planner.ts";
import {
  buildRequest,
  createTypeSafeProvider,
  createTypeSafeRequestEstimator,
  type TypeSafeTrace,
} from "../providers/typesafe/provider.ts";
import { renderPretty } from "../reporters/render.ts";
import { UnitExtractor } from "../units/extract.ts";
import { resolveRequestedPaths } from "../config/project.ts";
import { loadProjectContext } from "./context.ts";
import { closeDecisionCache, openDecisionCache } from "./decision-cache.ts";
import { failsRun } from "../diagnostics/build.ts";
import { runEvaluationPlan } from "../engine/run.ts";

export async function runInspectCommand(args: string[]): Promise<number> {
  const planOnly = args.includes("--plan-only");
  const useCache = !args.includes("--no-cache");
  const positional = args.filter(
    (arg) => arg !== "--plan-only" && arg !== "--no-cache",
  );

  if (positional.length !== 2) {
    throw new Error(
      "inspectは <rule-id> <file> [--plan-only] [--no-cache] の形式で指定してください。",
    );
  }

  const [ruleId, fileArg] = positional;

  if (!ruleId || !fileArg) {
    throw new Error("inspectのrule-idまたはfileがありません。");
  }

  const { projectRoot, config, catalog, rules } = await loadProjectContext();
  const rule = rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(`ruleが存在しません: ${ruleId}`);
  }

  const [absolutePath] = await resolveRequestedPaths(
    projectRoot,
    [fileArg],
    projectRoot,
  );

  if (!absolutePath) {
    throw new Error(`fileが存在しません: ${fileArg}`);
  }

  const path = relative(projectRoot, absolutePath).split(sep).join("/");
  const source = await Bun.file(absolutePath).text();
  const pathMatch = bunGlobPathMatcher(rule.paths, path);
  const extractor = await UnitExtractor.create(catalog);
  const plan = buildEvaluationPlan({
    documents: [{ path, source }],
    rules: [rule],
    extractor,
    matchesPath: bunGlobPathMatcher,
  });
  const batches = buildDecisionBatches({
    plan,
    rules: [rule],
    estimator: createTypeSafeRequestEstimator(config.provider),
    budget: config.execution.requestTokenBudget,
  });
  const providerPayloads = batches.map(
    (batch) => buildRequest(config.provider.model, batch).body,
  );

  console.log("compiled rule");
  console.log(JSON.stringify(rule, null, 2));
  console.log("\npath match");
  console.log(pathMatch ? "matched" : "not matched");
  console.log("\nevaluation plan");
  console.log(JSON.stringify(plan, null, 2));
  console.log("\nprovider payload");
  console.log(JSON.stringify(providerPayloads, null, 2));

  if (planOnly || plan.files.length === 0) {
    return 0;
  }

  const traces: TypeSafeTrace[] = [];
  const provider = createTypeSafeProvider(config.provider, {
    onTrace: (trace) => traces.push(trace),
  });
  const cache = await openDecisionCache(projectRoot, useCache);
  const result = await runEvaluationPlan({
    plan,
    rules: [rule],
    provider,
    concurrency: 1,
    requestTokenBudget: config.execution.requestTokenBudget,
    ...(cache === undefined ? {} : { cache }),
  });
  await closeDecisionCache(cache);

  console.log("\nraw provider response");

  if (result.metrics.cache.hits > 0) {
    console.log(
      `${result.metrics.cache.hits}件はcacheから再利用したため、providerへ送っていません。--no-cacheで再判定できます。`,
    );
  }

  console.log(
    JSON.stringify(
      traces.map((trace) => trace.responseBody),
      null,
      2,
    ),
  );
  console.log("\ndiagnostic");
  process.stdout.write(renderPretty(result));

  return failsRun(result.diagnostics, "error") ? 1 : 0;
}

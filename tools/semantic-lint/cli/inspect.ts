import { relative, resolve, sep } from "node:path";

import { buildDecisionBatches } from "../planning/batches.ts";
import {
  buildEvaluationPlan,
  bunGlobPathMatcher,
} from "../planning/planner.ts";
import {
  buildRequest,
  createTypeSafeProvider,
  type TypeSafeTrace,
} from "../providers/typesafe/provider.ts";
import { renderPretty } from "../reporters/render.ts";
import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { resolveRequestedPaths } from "../config/project.ts";
import { loadProjectContext } from "./context.ts";
import { runEvaluationPlan } from "../engine/run.ts";

export async function runInspectCommand(args: string[]): Promise<number> {
  const planOnly = args.includes("--plan-only");
  const positional = args.filter((arg) => arg !== "--plan-only");

  if (positional.length !== 2) {
    throw new Error(
      "inspectは <rule-id> <file> [--plan-only] の形式で指定してください。",
    );
  }

  const [ruleId, fileArg] = positional;

  if (!ruleId || !fileArg) {
    throw new Error("inspectのrule-idまたはfileがありません。");
  }

  const { projectRoot, config, rules } = await loadProjectContext();
  const rule = rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(`ruleが存在しません: ${ruleId}`);
  }

  const [absolutePath] = await resolveRequestedPaths(
    projectRoot,
    [fileArg],
  );

  if (!absolutePath) {
    throw new Error(`fileが存在しません: ${fileArg}`);
  }

  const path = relative(projectRoot, absolutePath).split(sep).join("/");
  const source = await Bun.file(absolutePath).text();
  const pathMatch = bunGlobPathMatcher(rule.paths, path);
  const scopes = await createDefaultScopeRegistry(projectRoot);
  const plan = buildEvaluationPlan({
    documents: [{ path, source }],
    rules: [rule],
    scopes,
    matchesPath: bunGlobPathMatcher,
    statuses: [rule.status],
  });
  const batches = buildDecisionBatches({
    plan,
    rules: [rule],
    maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
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
  const result = await runEvaluationPlan({
    plan,
    rules: [rule],
    provider,
    concurrency: 1,
    maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
  });

  console.log("\nraw provider response");
  console.log(
    JSON.stringify(
      traces.map((trace) => trace.responseBody),
      null,
      2,
    ),
  );
  console.log("\ndiagnostic");
  process.stdout.write(renderPretty(result));

  return result.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  )
    ? 1
    : 0;
}

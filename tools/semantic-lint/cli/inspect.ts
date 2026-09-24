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
import type { SemanticLintConfig } from "../config/config.ts";
import type { Rule } from "../domain/model.ts";
import {
  buildChoiceRequestBody,
  createTypeSafeChoiceProvider,
} from "../providers/typesafe/provider.ts";
import {
  buildUnitPlan,
  isUnitRule,
  runUnitPlan,
} from "../units/engine.ts";
import { MAX_CHOICES } from "../units/locate.ts";
import { buildUnitState, judgeQuestion } from "../units/prompts.ts";
import { createDefaultUnitRegistry } from "../units/registry.ts";

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
    projectRoot,
  );

  if (!absolutePath) {
    throw new Error(`fileが存在しません: ${fileArg}`);
  }

  const path = relative(projectRoot, absolutePath).split(sep).join("/");
  const source = await Bun.file(absolutePath).text();
  const pathMatch = bunGlobPathMatcher(rule.paths, path);

  if (isUnitRule(rule)) {
    return inspectUnitRule({ rule, path, source, pathMatch, planOnly, config });
  }
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

/** unit ruleの単位・文脈・判定payloadを確認する。位置特定payloadは判定後にだけ作られる。 */
async function inspectUnitRule(options: {
  rule: Rule;
  path: string;
  source: string;
  pathMatch: boolean;
  planOnly: boolean;
  config: SemanticLintConfig;
}): Promise<number> {
  const { rule, path, source, pathMatch, planOnly, config } = options;
  const units = createDefaultUnitRegistry();
  const plan = buildUnitPlan({
    documents: [{ path, source }],
    rules: [rule],
    units,
    matchesPath: bunGlobPathMatcher,
    statuses: [rule.status],
  });
  const file = plan.files[0];

  console.log("compiled rule");
  console.log(JSON.stringify(rule, null, 2));
  console.log("\npath match");
  console.log(pathMatch ? "matched" : "not matched");

  if (!file) {
    return 0;
  }

  console.log(`\nunits (${rule.unit})`);

  for (const unit of file.document.units) {
    console.log(
      [
        unit.id,
        `lines ${unit.span.startLine}-${unit.span.endLine}`,
        `parent ${unit.parentId ?? "-"}`,
        `context [${unit.contextIds.join(", ")}]`,
        `locate targets ${unit.locateTargets.length}`,
        unit.symbol,
      ].join("\t"),
    );
  }

  console.log("\noutline");
  console.log(file.document.outline);
  console.log("\ncontexts");

  for (const context of file.document.contexts) {
    console.log(`[${context.id}] ${context.description}`);
    console.log(context.source);
  }

  const questionsPerRequest = config.execution.maxDecisionsPerRequest;
  const payloads = [];

  for (
    let offset = 0;
    offset < file.tasks.length;
    offset += questionsPerRequest
  ) {
    const tasks = file.tasks.slice(offset, offset + questionsPerRequest);
    const unitKeys = new Map(
      tasks.map((task, index) => [task.unit.id, "u" + index]),
    );
    payloads.push(
      buildChoiceRequestBody(config.provider.model, {
        state: buildUnitState(
          file.document,
          tasks.map((task) => task.unit),
          unitKeys,
        ),
        questions: Object.fromEntries(
          tasks.map((task, index) => [
            "q" + index,
            judgeQuestion({
              unit: task.unit,
              unitKey: unitKeys.get(task.unit.id) ?? "",
              unitDescription: units.description(task.unit.kind),
              predicate: task.rule.predicate,
            }),
          ]),
        ),
      }),
    );
  }

  console.log(
    `\njudge payload (${payloads.length} requests, ${file.tasks.length} questions; 位置特定はviolation単位だけ、1質問${MAX_CHOICES}選択肢まで)`,
  );
  console.log(JSON.stringify(payloads, null, 2));

  if (planOnly) {
    return 0;
  }

  const traces: TypeSafeTrace[] = [];
  const result = await runUnitPlan({
    plan,
    units,
    provider: createTypeSafeChoiceProvider(config.provider, {
      onTrace: (trace) => traces.push(trace),
    }),
    engine: {
      concurrency: 1,
      maxQuestionsPerRequest: questionsPerRequest,
    },
  });

  console.log("\nraw provider response");
  console.log(JSON.stringify(traces.map((trace) => trace.responseBody), null, 2));
  console.log("\ndiagnostic");
  process.stdout.write(renderPretty(result));

  return result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? 1
    : 0;
}

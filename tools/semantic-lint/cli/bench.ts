import { resolve } from "node:path";

import type { RunResult } from "../domain/model.ts";
import {
  type BenchmarkRuleResult,
  benchmarkRunFromRunResult,
  findRule,
  runGoldenBenchmark,
} from "../eval/benchmark.ts";
import {
  buildBenchmarkReport,
  renderBenchmarkReport,
} from "../eval/benchmark-report.ts";
import {
  type GoldenSet,
  goldenFileStatus,
  loadGoldenSets,
  resolveGoldenFiles,
} from "../eval/golden.ts";
import {
  createTypeSafeChoiceProvider,
  createTypeSafeProvider,
} from "../providers/typesafe/provider.ts";
import { createDefaultScopeRegistry } from "../scopes/default.ts";
import { DEFAULT_UNIT_ENGINE_OPTIONS } from "../units/engine.ts";
import { LOCATE_MODES, type LocateMode } from "../units/locate.ts";
import {
  CONTEXT_MODES,
  type ContextMode,
  DEFAULT_UNIT_OPTIONS,
  NESTING_STRATEGIES,
  type NestingStrategy,
} from "../units/model.ts";
import { createDefaultUnitRegistry } from "../units/registry.ts";
import { loadProjectContext } from "./context.ts";

type BenchOptions = {
  ruleIds: string[];
  repeat: number;
  lineTolerance: number;
  format: "pretty" | "json";
  scoreFiles: string[];
  rulesFrom?: string;
  nesting: NestingStrategy;
  context: ContextMode;
  locate: LocateMode;
};

export async function runBenchCommand(args: string[]): Promise<number> {
  const options = parseBenchOptions(args);
  const { projectRoot, config, rules } = await loadProjectContext();
  const allSets = await loadGoldenSets(projectRoot, config.goldenDir);
  const missing = options.ruleIds.filter(
    (ruleId) => !allSets.some((set) => set.ruleId === ruleId),
  );

  if (missing.length > 0) {
    throw new Error(`goldenがないruleです: ${missing.join(", ")}`);
  }

  const sets =
    options.ruleIds.length === 0
      ? allSets
      : allSets.filter((set) => options.ruleIds.includes(set.ruleId));

  if (sets.length === 0) {
    throw new Error(`goldenがありません: ${config.goldenDir}`);
  }

  const unitEngine = {
    unitOptions: {
      ...DEFAULT_UNIT_OPTIONS,
      nesting: options.nesting,
      contextMode: options.context,
    },
    locateMode: options.locate,
  };
  const results =
    options.scoreFiles.length > 0
      ? await scoreRunResults(
          projectRoot,
          sets,
          rules,
          options.scoreFiles,
          options.rulesFrom,
        )
      : await runGoldenBenchmark({
          targets: await Promise.all(
            sets.map(async (golden) => ({
              golden,
              files: await resolveGoldenFiles(projectRoot, golden),
            })),
          ),
          rules,
          scopes: await createDefaultScopeRegistry(projectRoot),
          provider: createTypeSafeProvider(config.provider),
          units: createDefaultUnitRegistry(),
          choiceProvider: createTypeSafeChoiceProvider(config.provider),
          unitEngine,
          ...(options.rulesFrom === undefined
            ? {}
            : { rulesFrom: options.rulesFrom }),
          repeat: options.repeat,
          concurrency: config.execution.concurrency,
          maxDecisionsPerRequest: config.execution.maxDecisionsPerRequest,
        });
  const report = buildBenchmarkReport(results, {
    lineTolerance: options.lineTolerance,
    variant: {
      rules: options.rulesFrom ?? "golden",
      nesting: options.nesting,
      context: options.context,
      locate: options.locate,
    },
  });

  process.stdout.write(
    options.format === "json"
      ? JSON.stringify(report, null, 2) + "\n"
      : renderBenchmarkReport(report),
  );
  return 0;
}

/** 既存のRunResult JSONを1ファイル1runとして採点する。providerは呼ばない。 */
async function scoreRunResults(
  projectRoot: string,
  sets: GoldenSet[],
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"],
  scoreFiles: string[],
  rulesFrom: string | undefined,
): Promise<BenchmarkRuleResult[]> {
  const runResults = await Promise.all(
    scoreFiles.map(
      async (path) =>
        (await Bun.file(resolve(projectRoot, path)).json()) as RunResult,
    ),
  );

  return Promise.all(
    sets.map(async (golden) => ({
      golden,
      rule: findRule(rules, golden, rulesFrom),
      fileStatuses: await Promise.all(
        golden.files.map(async (file) => ({
          path: file.path,
          status: await goldenFileStatus(projectRoot, file),
        })),
      ),
      runs: runResults.map((result) =>
        benchmarkRunFromRunResult(
          result,
          findRule(rules, golden, rulesFrom).id,
        ),
      ),
    })),
  );
}

function parseBenchOptions(args: string[]): BenchOptions {
  const options: BenchOptions = {
    ruleIds: [],
    repeat: 1,
    lineTolerance: 1,
    format: "pretty",
    scoreFiles: [],
    nesting: DEFAULT_UNIT_OPTIONS.nesting,
    context: DEFAULT_UNIT_OPTIONS.contextMode,
    locate: DEFAULT_UNIT_ENGINE_OPTIONS.locateMode,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    switch (arg) {
      case "--repeat": {
        const repeat = Number(value);

        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) {
          throw new Error("--repeatには1〜100の整数を指定してください。");
        }

        options.repeat = repeat;
        index += 1;
        break;
      }
      case "--line-tolerance": {
        const tolerance = Number(value);

        if (!Number.isInteger(tolerance) || tolerance < 0) {
          throw new Error("--line-toleranceには0以上の整数を指定してください。");
        }

        options.lineTolerance = tolerance;
        index += 1;
        break;
      }
      case "--format":
        if (value !== "pretty" && value !== "json") {
          throw new Error("--formatはpretty / jsonを指定してください。");
        }

        options.format = value;
        index += 1;
        break;
      case "--rules-from":
        if (!value) {
          throw new Error("--rules-fromにはruleset idを指定してください。");
        }

        options.rulesFrom = value;
        index += 1;
        break;
      case "--nesting":
        options.nesting = oneOf(NESTING_STRATEGIES, value, arg);
        index += 1;
        break;
      case "--context":
        options.context = oneOf(CONTEXT_MODES, value, arg);
        index += 1;
        break;
      case "--locate":
        options.locate = oneOf(LOCATE_MODES, value, arg);
        index += 1;
        break;
      case "--score":
        if (!value) {
          throw new Error("--scoreにはRunResult JSONのpathを指定してください。");
        }

        options.scoreFiles.push(value);
        index += 1;
        break;
      default:
        if (arg?.startsWith("-")) {
          throw new Error(`不明なbenchオプションです: ${arg}`);
        }

        if (arg) {
          options.ruleIds.push(arg);
        }
    }
  }

  if (options.scoreFiles.length > 0 && options.repeat !== 1) {
    throw new Error("--scoreと--repeatは同時に指定できません。");
  }

  return options;
}

function oneOf<T extends string>(
  values: readonly T[],
  value: string | undefined,
  option: string,
): T {
  if (value === undefined || !values.includes(value as T)) {
    throw new Error(`${option}は${values.join(" / ")}を指定してください。`);
  }

  return value as T;
}

import { resolve } from "node:path";

import type { RunResult } from "../domain/model.ts";
import {
  type BenchmarkRuleResult,
  benchmarkRunFromRunResult,
  findRule,
  planGoldenBenchmark,
  ruleShare,
  runGoldenBenchmark,
} from "../eval/benchmark.ts";
import {
  buildBenchmarkReport,
  renderBenchmarkReport,
  renderBenchmarkSummary,
} from "../eval/benchmark-report.ts";
import {
  type GoldenSet,
  goldenFileStatus,
  loadGoldenSets,
  resolveGoldenFiles,
} from "../eval/golden.ts";
import {
  createTypeSafeProvider,
  createTypeSafeRequestEstimator,
} from "../providers/typesafe/provider.ts";
import { UnitExtractor } from "../units/extract.ts";
import { loadProjectContext } from "./context.ts";

type BenchOptions = {
  ruleIds: string[];
  repeat: number;
  lineTolerance: number;
  format: "pretty" | "json" | "summary";
  scoreFiles: string[];
  planOnly: boolean;
};

export async function runBenchCommand(args: string[]): Promise<number> {
  const options = parseBenchOptions(args);
  const { projectRoot, config, catalog, rules } = await loadProjectContext();
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

  if (options.scoreFiles.length > 0) {
    const report = buildBenchmarkReport(
      await scoreRunResults(projectRoot, sets, rules, options.scoreFiles),
      { lineTolerance: options.lineTolerance },
    );
    writeReport(report, options.format);
    return 0;
  }

  const targets = await Promise.all(
    sets.map(async (golden) => ({
      golden,
      files: await resolveGoldenFiles(projectRoot, golden),
    })),
  );
  const linesByRule = new Map(
    targets.map(({ golden, files }) => [
      golden.ruleId,
      files.reduce((sum, file) => sum + file.source.split("\n").length, 0),
    ]),
  );
  const extractor = await UnitExtractor.create(catalog);

  if (options.planOnly) {
    const planned = planGoldenBenchmark({
      targets,
      rules,
      extractor,
      estimator: createTypeSafeRequestEstimator(config.provider),
      requestTokenBudget: config.execution.requestTokenBudget,
    });
    process.stdout.write(
      renderBenchmarkPlan(planned.requests, planned.lineRules, linesByRule),
    );
    return 0;
  }

  const result = await runGoldenBenchmark({
    targets,
    rules,
    extractor,
    provider: createTypeSafeProvider(config.provider),
    repeat: options.repeat,
    concurrency: config.execution.concurrency,
    requestTokenBudget: config.execution.requestTokenBudget,
  });
  const report = buildBenchmarkReport(result.rules, {
    lineTolerance: options.lineTolerance,
    linesByRule,
    usage: {
      lineRules: result.plan.lineRules,
      planned: result.plan.requests,
      runRequests: result.runRequests,
    },
  });

  writeReport(report, options.format);
  return 0;
}

function writeReport(
  report: ReturnType<typeof buildBenchmarkReport>,
  format: BenchOptions["format"],
): void {
  process.stdout.write(
    format === "json"
      ? JSON.stringify(report, null, 2) + "\n"
      : format === "summary"
        ? renderBenchmarkSummary(report)
        : renderBenchmarkReport(report),
  );
}

function renderBenchmarkPlan(
  requests: ReturnType<typeof planGoldenBenchmark>["requests"],
  lineRules: number,
  linesByRule: ReadonlyMap<string, number>,
): string {
  const total = requests.reduce((sum, record) => sum + record.estimate.total, 0);
  const lines = [
    "benchmark request plan (providerは呼んでいません。tokenはJev課金係数による推定。違反箇所を問う2段目は含めない)",
    `requests: ${requests.length}`,
    `estimated input tokens: ${total} (1 run)`,
    `per line × rule: ${lineRules === 0 ? "-" : (total / lineRules).toFixed(2)} (${lineRules} line-rules)`,
  ];

  for (const [ruleId, ruleLines] of linesByRule) {
    const estimated = requests.reduce(
      (sum, record) => sum + record.estimate.total * ruleShare(record, ruleId),
      0,
    );
    const count = requests.filter((record) => ruleShare(record, ruleId) > 0)
      .length;
    lines.push(
      `  ${ruleId}: requests ${count}, 推定input ${Math.round(estimated)} (${ruleLines === 0 ? "-" : (estimated / ruleLines).toFixed(2)} / 行)`,
    );
  }

  return lines.join("\n") + "\n";
}

/** 既存のRunResult JSONを1ファイル1runとして採点する。providerは呼ばない。 */
async function scoreRunResults(
  projectRoot: string,
  sets: GoldenSet[],
  rules: Awaited<ReturnType<typeof loadProjectContext>>["rules"],
  scoreFiles: string[],
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
      rule: findRule(rules, golden),
      fileStatuses: await Promise.all(
        golden.files.map(async (file) => ({
          path: file.path,
          status: await goldenFileStatus(projectRoot, file),
        })),
      ),
      runs: runResults.map((result) =>
        benchmarkRunFromRunResult(result, golden.ruleId),
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
    planOnly: false,
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
      case "--plan-only":
        options.planOnly = true;
        break;
      case "--format":
        if (value !== "pretty" && value !== "json" && value !== "summary") {
          throw new Error("--formatはpretty / json / summaryを指定してください。");
        }

        options.format = value;
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

  if (options.scoreFiles.length > 0 && options.planOnly) {
    throw new Error("--scoreと--plan-onlyは同時に指定できません。");
  }

  return options;
}

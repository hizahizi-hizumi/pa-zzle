import { loadGoldenCases } from "../config/cases.ts";
import { runGoldenCases } from "../eval/run.ts";
import { renderGoldenCaseReport } from "../eval/report.ts";
import { createTypeSafeProvider } from "../providers/typesafe/provider.ts";
import { UnitExtractor } from "../units/extract.ts";
import { loadProjectContext } from "./context.ts";

export async function runEvalCommand(args: string[]): Promise<number> {
  const { ruleIds, repeat } = parseEvalOptions(args);
  const { projectRoot, config, catalog, rules } = await loadProjectContext();
  const allCases = await loadGoldenCases(projectRoot, config.casesDir);
  const selectedCases =
    ruleIds.length === 0
      ? allCases
      : allCases.filter((goldenCase) => ruleIds.includes(goldenCase.ruleId));

  const missing = ruleIds.filter(
    (ruleId) => !rules.some((rule) => rule.id === ruleId),
  );

  if (missing.length > 0) {
    throw new Error(`存在しないruleです: ${missing.join(", ")}`);
  }

  if (selectedCases.length === 0) {
    throw new Error("対象となるgolden caseがありません。");
  }

  const extractor = await UnitExtractor.create(catalog);
  const provider = createTypeSafeProvider(config.provider);
  const results = await runGoldenCases({
    projectRoot,
    cases: selectedCases,
    rules,
    extractor,
    provider,
    repeat,
    concurrency: config.execution.concurrency,
    requestTokenBudget: config.execution.requestTokenBudget,
  });

  process.stdout.write(renderGoldenCaseReport(results));
  return 0;
}

function parseEvalOptions(args: string[]): {
  ruleIds: string[];
  repeat: number;
} {
  const ruleIds: string[] = [];
  let repeat = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--repeat") {
      const value = Number(args[index + 1]);

      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error("--repeatには1〜100の整数を指定してください。");
      }

      repeat = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("-")) {
      throw new Error(`不明なevalオプションです: ${arg}`);
    }

    if (arg) {
      ruleIds.push(arg);
    }
  }

  return { ruleIds, repeat };
}

import { loadCalibrationCases } from "./cases.ts";
import { evaluateCalibrationCases } from "./calibration.ts";
import {
  loadLintConfig,
  loadRules,
} from "./config.ts";
import { printCalibrationReport } from "./eval-reporter.ts";
import { findProjectRoot } from "./project.ts";
import { createTypeSafeProvider } from "./providers/typesafe.ts";

type EvalOptions = {
  repeat: number;
  ruleIds: string[];
};

async function main(): Promise<void> {
  const startedAt = performance.now();

  try {
    const options = parseArgs(process.argv.slice(2));
    const projectRoot = await findProjectRoot();
    const config = await loadLintConfig(projectRoot);
    const rules = await loadRules(projectRoot, config.rulesDir);
    const selectedRules = selectRules(rules, options.ruleIds);
    const cases = await loadCalibrationCases(
      projectRoot,
      config.casesDir,
      selectedRules,
    );

    if (cases.length === 0) {
      console.log("対象となるcalibration caseはありません。");
      return;
    }

    console.log(
      "Semantic lint eval: " +
        cases.length +
        "ケース × " +
        options.repeat +
        "回を評価します。",
    );
    console.log("並列数: " + config.concurrency + "\n");

    const provider = createTypeSafeProvider(config.provider);
    const results = await evaluateCalibrationCases(
      cases,
      provider,
      options.repeat,
      config.concurrency,
    );

    console.log("");

    printCalibrationReport(
      results,
      performance.now() - startedAt,
      options.repeat,
    );
  } catch (error) {
    console.error(
      "semantic lint evalの実行に失敗しました: " +
        (error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 2;
  }
}

function parseArgs(args: string[]): EvalOptions {
  const ruleIds: string[] = [];
  let repeat = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--repeat") {
      const rawRepeat = args[index + 1];
      const parsedRepeat = Number(rawRepeat);

      if (
        rawRepeat === undefined ||
        !Number.isInteger(parsedRepeat) ||
        parsedRepeat < 1 ||
        parsedRepeat > 100
      ) {
        throw new Error("--repeatには1〜100の整数を指定してください。");
      }

      repeat = parsedRepeat;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg?.startsWith("-")) {
      throw new Error("不明なオプションです: " + arg);
    }

    if (arg) {
      ruleIds.push(arg);
    }
  }

  return { repeat, ruleIds };
}

function selectRules<T extends { id: string }>(
  rules: T[],
  ruleIds: string[],
): T[] {
  if (ruleIds.length === 0) {
    return rules;
  }

  const requested = new Set(ruleIds);
  const selected = rules.filter((rule) => requested.has(rule.id));
  const found = new Set(selected.map((rule) => rule.id));
  const unknown = ruleIds.filter((ruleId) => !found.has(ruleId));

  if (unknown.length > 0) {
    throw new Error("存在しないruleです: " + unknown.join(", "));
  }

  return selected;
}

function printHelp(): void {
  console.log("semantic lint eval\n");
  console.log("使い方:");
  console.log("  semantic-lint:eval");
  console.log("  semantic-lint:eval --repeat 10");
  console.log("  semantic-lint:eval <rule-id...> --repeat 10\n");
  console.log(
    "rule-idを指定しない場合は、caseが定義されている全ruleを評価します。\n",
  );
  console.log("オプション:");
  console.log("  --repeat <1-100>  各caseの反復回数。既定値は1");
  console.log("  -h, --help        このヘルプを表示\n");
  console.log("環境変数:");
  console.log("  TYPESAFE_API_KEY  TypeSafe APIキー");
}

await main();

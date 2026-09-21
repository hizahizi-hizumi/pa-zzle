import { loadLintConfig, loadRules } from "./config.ts";
import { discoverTargets } from "./discover.ts";
import { evaluateTargets } from "./engine.ts";
import { findProjectRoot, resolveScopes } from "./project.ts";
import { createTypeSafeProvider } from "./providers/typesafe.ts";
import { printReport } from "./reporter.ts";

type CliOptions = {
  verbose: boolean;
  paths: string[];
};

async function main(): Promise<void> {
  const startedAt = performance.now();

  try {
    const options = parseArgs(process.argv.slice(2));
    const projectRoot = await findProjectRoot();
    const config = await loadLintConfig(projectRoot);
    const rules = await loadRules(projectRoot, config.rulesDir);
    const scopes = await resolveScopes(projectRoot, options.paths);
    const targets = await discoverTargets(projectRoot, scopes, rules);

    if (targets.length === 0) {
      console.log("適用対象となるsemantic lint ruleはありません。");
      return;
    }

    console.log(`Semantic lint: ${targets.length}ファイルを検査します。`);

    const provider = createTypeSafeProvider(config.provider);
    const results = await evaluateTargets(
      targets,
      provider,
      config.concurrency,
    );
    const totalDurationMs = performance.now() - startedAt;

    console.log("");

    const summary = printReport(results, {
      verbose: options.verbose,
      totalDurationMs,
      concurrency: config.concurrency,
    });

    if (summary.errors > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `semantic lintの実行に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 2;
  }
}

function parseArgs(args: string[]): CliOptions {
  const paths: string[] = [];
  let verbose = false;

  for (const arg of args) {
    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith("-")) {
      throw new Error(`不明なオプションです: ${arg}`);
    }

    paths.push(arg);
  }

  return { verbose, paths };
}

function printHelp(): void {
  console.log(`semantic lint

使い方:
  semantic-lint
  semantic-lint <path...>
  semantic-lint --verbose <path...>

パスを指定しない場合は、現在のディレクトリを対象にします。

オプション:
  --verbose    問題なし・対象外を含む全判定を表示
  -h, --help   このヘルプを表示

環境変数:
  TYPESAFE_API_KEY    TypeSafe APIキー
`);
}

await main();

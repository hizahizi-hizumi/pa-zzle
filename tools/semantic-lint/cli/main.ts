import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findProjectRoot } from "../config/project.ts";
import { runCheckCommand } from "./check.ts";
import { runDoctorCommand } from "./doctor.ts";
import { runEvalCommand } from "./eval.ts";
import { runInspectCommand } from "./inspect.ts";
import { runRulesCommand } from "./rules.ts";

const PROJECT_ENV_LOADED = "SEMANTIC_LINT_PROJECT_ENV_LOADED";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case "check":
        process.exitCode = await runCheckCommand(args);
        return;
      case "eval":
        process.exitCode = await runEvalCommand(args);
        return;
      case "inspect":
        process.exitCode = await runInspectCommand(args);
        return;
      case "rules":
        process.exitCode = await runRulesCommand(args);
        return;
      case "doctor":
        process.exitCode = await runDoctorCommand(args);
        return;
      case "--help":
      case "-h":
      case undefined:
        printHelp();
        return;
      default:
        throw new Error(`不明なsubcommandです: ${command}`);
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

async function bootstrap(): Promise<void> {
  if (process.env[PROJECT_ENV_LOADED] === "1") {
    await main();
    return;
  }

  const projectRoot = await findProjectRoot();
  const envPath = resolve(projectRoot, ".env");

  if (!(await Bun.file(envPath).exists())) {
    await main();
    return;
  }

  const child = Bun.spawn(
    [
      process.execPath,
      `--env-file=${envPath}`,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        [PROJECT_ENV_LOADED]: "1",
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  process.exitCode = await child.exited;
}

function printHelp(): void {
  console.log(`semantic lint

使い方:
  semantic-lint check [paths...] [options]
  semantic-lint eval [rule-id...] [--repeat N]
  semantic-lint inspect <rule-id> <file> [--plan-only] [--no-cache]
  semantic-lint rules [ruleset-or-rule]
  semantic-lint doctor

check options:
  --format pretty|compact|json
  --include-draft
  --files-from <path>
  --fail-on error|warning
  --fail-on-unknown
  --no-cache
`);
}

await bootstrap();

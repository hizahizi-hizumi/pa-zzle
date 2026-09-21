import { runCheckCommand } from "./check.ts";
import { runDoctorCommand } from "./doctor.ts";
import { runEvalCommand } from "./eval.ts";
import { runInspectCommand } from "./inspect.ts";
import { runRulesCommand } from "./rules.ts";

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

function printHelp(): void {
  console.log(`semantic lint

使い方:
  semantic-lint check [paths...] [options]
  semantic-lint eval [rule-id...] [--repeat N]
  semantic-lint inspect <rule-id> <file> [--plan-only]
  semantic-lint rules [ruleset-or-rule]
  semantic-lint doctor

check options:
  --format pretty|compact|json
  --include-draft
  --files-from <path>
  --fail-on error|warning
  --fail-on-unknown
`);
}

await main();

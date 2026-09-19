import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = 1;

function parseArguments(arguments_) {
  const options = {
    baseline: "",
    config: "",
    path: "",
    rules: [],
    update: false,
  };
  for (const argument of arguments_) {
    if (argument === "--update-baseline") options.update = true;
    else if (argument.startsWith("--baseline="))
      options.baseline = argument.slice("--baseline=".length);
    else if (argument.startsWith("--config="))
      options.config = argument.slice("--config=".length);
    else if (argument.startsWith("--path="))
      options.path = argument.slice("--path=".length);
    else if (argument.startsWith("--only="))
      options.rules.push(argument.slice("--only=".length));
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (
    !options.baseline ||
    !options.config ||
    !options.path ||
    options.rules.length === 0
  ) {
    throw new Error(
      "--baseline, --config, --path, and at least one --only are required",
    );
  }
  return options;
}

function entryKey(entry) {
  return JSON.stringify(entry);
}

function sortEntries(entries) {
  return entries.sort((left, right) => {
    const leftKey = entryKey(left);
    const rightKey = entryKey(right);
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  });
}

function diagnosticEntry(diagnostic) {
  const category = diagnostic.code?.value;
  const file = diagnostic.location?.path?.replaceAll("\\", "/");
  const line = diagnostic.location?.range?.start?.line;
  if (
    typeof category !== "string" ||
    typeof file !== "string" ||
    typeof line !== "number"
  ) {
    throw new Error("Biome returned an unsupported diagnostic shape");
  }
  const sourceLine = readFileSync(file, "utf8").split(/\r?\n/)[line - 1];
  if (sourceLine === undefined) {
    throw new Error(`Biome returned an invalid source line for ${file}`);
  }
  return { category, file, sourceLine };
}

function runBiome(config, path, rules) {
  const executable = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../node_modules/.bin",
    process.platform === "win32" ? "biome.cmd" : "biome",
  );
  const result = spawnSync(
    executable,
    [
      "lint",
      path,
      `--config-path=${resolve(config)}`,
      "--reporter=rdjson",
      "--max-diagnostics=none",
      ...rules.map((rule) => `--only=${rule}`),
    ],
    {
      encoding: "utf8",
      env: { ...process.env, TERM: process.env.TERM ?? "dumb" },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `Biome failed with exit code ${result.status}.\n${result.stderr}`,
    );
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Biome did not return valid RDJSON.\n${result.stdout}\n${result.stderr}`,
    );
  }
  if (!Array.isArray(report.diagnostics)) {
    throw new Error("Biome RDJSON did not contain diagnostics");
  }

  const selectedRules = new Set(rules);
  const unexpected = report.diagnostics.filter(
    (diagnostic) => !selectedRules.has(diagnostic.code?.value),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Biome returned an unselected diagnostic: ${unexpected[0].code?.value}`,
    );
  }
  return sortEntries(report.diagnostics.map(diagnosticEntry));
}

function serializeBaseline(entries) {
  const diagnostics = {};
  for (const { category, file, sourceLine } of entries) {
    diagnostics[category] ??= {};
    diagnostics[category][file] ??= [];
    diagnostics[category][file].push(sourceLine);
  }
  return { schema: SCHEMA, diagnostics };
}

function readBaseline(path) {
  const baseline = JSON.parse(readFileSync(path, "utf8"));
  if (
    baseline.schema !== SCHEMA ||
    typeof baseline.diagnostics !== "object" ||
    baseline.diagnostics === null
  ) {
    throw new Error(`Unsupported baseline format: ${path}`);
  }

  const entries = [];
  for (const [category, files] of Object.entries(baseline.diagnostics)) {
    if (typeof files !== "object" || files === null) {
      throw new Error(`Unsupported baseline format: ${path}`);
    }
    for (const [file, sourceLines] of Object.entries(files)) {
      if (
        !Array.isArray(sourceLines) ||
        !sourceLines.every((line) => typeof line === "string")
      ) {
        throw new Error(`Unsupported baseline format: ${path}`);
      }
      for (const sourceLine of sourceLines)
        entries.push({ category, file, sourceLine });
    }
  }
  return sortEntries(entries);
}

function subtract(left, right) {
  const remaining = new Map();
  for (const entry of right) {
    const key = entryKey(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return left.filter((entry) => {
    const key = entryKey(entry);
    const count = remaining.get(key) ?? 0;
    if (count === 0) return true;
    remaining.set(key, count - 1);
    return false;
  });
}

function printDifference(title, diagnostics) {
  if (diagnostics.length === 0) return;
  console.error(`\n${title} (${diagnostics.length}):`);
  for (const diagnostic of diagnostics) {
    console.error(
      `- ${diagnostic.file} [${diagnostic.category}] ${diagnostic.sourceLine.trim()}`,
    );
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const baselinePath = resolve(options.baseline);
  const current = runBiome(options.config, options.path, options.rules);

  if (options.update) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify(serializeBaseline(current), null, 2)}\n`,
    );
    const formatResult = spawnSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../node_modules/.bin",
        process.platform === "win32" ? "biome.cmd" : "biome",
      ),
      ["format", "--write", baselinePath],
      { encoding: "utf8" },
    );
    if (formatResult.error) throw formatResult.error;
    if (formatResult.status !== 0) {
      throw new Error(
        `Biome formatter failed with exit code ${formatResult.status}.\n${formatResult.stderr}`,
      );
    }
    console.log(
      `biome-baseline: updated ${options.baseline} (${current.length} diagnostics)`,
    );
    return;
  }

  let baseline;
  try {
    baseline = readBaseline(baselinePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Baseline not found. Run again with --update-baseline.`);
    }
    throw error;
  }

  const added = subtract(current, baseline);
  const removed = subtract(baseline, current);
  printDifference("New diagnostics", added);
  printDifference("Stale baseline diagnostics", removed);
  if (added.length > 0 || removed.length > 0) {
    throw new Error("Biome diagnostics differ from the baseline");
  }
  console.log(`biome-baseline: PASS (${current.length} diagnostics)`);
}

try {
  main();
} catch (error) {
  console.error(
    `biome-baseline: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

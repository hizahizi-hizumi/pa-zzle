import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseArguments(arguments_) {
  let baseline;
  let update = false;

  for (const argument of arguments_) {
    if (argument === "--update-baseline") update = true;
    else if (argument.startsWith("--baseline=")) {
      baseline = argument.slice("--baseline=".length);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!baseline) throw new Error("--baseline is required");
  return { baseline, update };
}

function biomeExecutable() {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../node_modules/.bin",
    process.platform === "win32" ? "biome.cmd" : "biome",
  );
}

function runBiome(arguments_) {
  const result = spawnSync(biomeExecutable(), arguments_, {
    encoding: "utf8",
    env: { ...process.env, TERM: process.env.TERM ?? "dumb" },
  });

  if (result.error) throw result.error;
  return result;
}

function diagnosticKey(diagnostic) {
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

  return [category, file, sourceLine];
}

function currentDiagnostics() {
  const result = runBiome([
    "check",
    ".",
    "--reporter=rdjson",
    "--max-diagnostics=none",
  ]);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `Biome failed with exit code ${result.status}.\n${result.stderr}`,
    );
  }

  const report = JSON.parse(result.stdout);
  if (!Array.isArray(report.diagnostics)) {
    throw new Error("Biome RDJSON did not contain diagnostics");
  }

  return report.diagnostics.map(diagnosticKey).sort();
}

function readBaseline(path) {
  const baseline = JSON.parse(readFileSync(path, "utf8"));
  if (
    !Array.isArray(baseline) ||
    !baseline.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 3 &&
        entry.every((value) => typeof value === "string"),
    )
  ) {
    throw new Error(`Unsupported baseline format: ${path}`);
  }
  return new Set(baseline.map(JSON.stringify));
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const baselinePath = resolve(options.baseline);
  const current = currentDiagnostics();

  if (options.update) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    const formatted = runBiome(["format", "--write", baselinePath]);
    if (formatted.status !== 0) {
      throw new Error(
        `Biome formatter failed with exit code ${formatted.status}.\n${formatted.stderr}`,
      );
    }
    console.log(
      `biome-baseline: updated ${options.baseline} (${current.length})`,
    );
    return;
  }

  const baseline = readBaseline(baselinePath);
  const added = current.filter((entry) => !baseline.has(JSON.stringify(entry)));
  if (added.length === 0) {
    console.log(`biome-baseline: PASS (${current.length} diagnostics)`);
    return;
  }

  for (const [category, file, sourceLine] of added) {
    console.error(`- ${file} [${category}] ${sourceLine.trim()}`);
  }
  throw new Error(
    `Biome found ${added.length} diagnostics outside the baseline`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    `biome-baseline: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}

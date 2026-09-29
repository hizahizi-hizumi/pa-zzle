import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDependencyRuleOverrides,
  listConcreteGames,
} from "./dependency-rules";

const frontendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const biomeConfigPath = path.join(frontendDirectory, "biome.json");

const biomeConfig = JSON.parse(readFileSync(biomeConfigPath, "utf8"));
biomeConfig.overrides = createDependencyRuleOverrides(
  listConcreteGames(path.join(frontendDirectory, "src/games")),
);
writeFileSync(biomeConfigPath, `${JSON.stringify(biomeConfig, null, 2)}\n`);

const formatted = spawnSync(
  "bunx",
  ["biome", "format", "--write", "biome.json"],
  {
    cwd: frontendDirectory,
    stdio: "inherit",
  },
);
process.exit(formatted.status ?? 1);

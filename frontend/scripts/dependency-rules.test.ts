// @vitest-environment node
import { readFileSync } from "node:fs";
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

describe("createDependencyRuleOverrides", () => {
  const biomeConfig = JSON.parse(
    readFileSync(path.join(frontendDirectory, "biome.json"), "utf8"),
  );
  const games = listConcreteGames(path.join(frontendDirectory, "src/games"));

  test("biome.json の overrides が全ゲームから生成した依存規則と一致すること", () => {
    const overrides = createDependencyRuleOverrides(games);

    expect(
      biomeConfig.overrides,
      "bun run generate:dependency-rules で biome.json を更新する",
    ).toEqual(overrides);
  });
});

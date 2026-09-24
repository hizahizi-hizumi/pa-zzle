import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { ScopeRegistry } from "../scopes/registry.ts";
import { registerVitestScopes } from "../scopes/vitest.ts";
import { UnitExtractor } from "./extract.ts";
import { LineIndex } from "./position.ts";

const projectRoot = resolve(import.meta.dir, "../../..");

async function trackedTestFiles(): Promise<string[]> {
  const child = Bun.spawn(
    ["git", "ls-files", "*.test.ts", "*.test.tsx", "*.test.mjs"],
    { cwd: projectRoot, stdout: "pipe" },
  );
  const output = await new Response(child.stdout).text();
  await child.exited;

  return output.split("\n").filter(Boolean).sort();
}

const pairs = [
  ["vitest.test", "test"],
  ["vitest.describe", "test-group"],
  ["vitest.beforeEach", "setup"],
] as const;

describe("TS実装scopeからunitカタログへの移行", () => {
  test("全testファイルで旧scopeと同じsubjectを抽出する", async () => {
    const scopes = new ScopeRegistry();
    registerVitestScopes(scopes);
    const extractor = await UnitExtractor.create();
    const files = await trackedTestFiles();
    const extraSetups: string[] = [];
    let compared = 0;

    expect(files.length).toBeGreaterThan(40);

    for (const path of files) {
      const source = await Bun.file(resolve(projectRoot, path)).text();
      const document = { path, source };
      const lines = new LineIndex(source);
      const extracted = extractor.extract(
        document,
        pairs.map(([, unit]) => unit),
      );

      for (const [scope, unit] of pairs) {
        const before = scopes.extract(scope, document).map((subject) => ({
          range: subject.range,
          symbol: subject.symbol,
          source: subject.source,
        }));
        const after = (extracted.get(unit) ?? []).map((item) => ({
          range: lines.range(item),
          symbol: item.symbol,
          source: source.slice(item.start, item.end),
        }));

        if (unit === "setup") {
          extraSetups.push(
            ...after
              .filter((item) => item.symbol !== "beforeEach")
              .map((item) => `${path}:${item.range.startLine} ${item.symbol}`),
          );
          expect(after.filter((item) => item.symbol === "beforeEach")).toEqual(
            before,
          );
        } else {
          expect(after).toEqual(before);
        }

        compared += before.length;
      }
    }

    console.log(
      `compared ${compared} subjects in ${files.length} files; setup adds ${extraSetups.length}:\n${extraSetups.join("\n")}`,
    );
  });
});

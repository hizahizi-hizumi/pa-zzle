import { describe, expect, test } from "bun:test";

import {
  compileQueryFile,
  loadUnitCatalog,
  UnitCatalog,
  type UnitVocabularyEntry,
} from "./catalog.ts";

const vocabulary: UnitVocabularyEntry[] = [
  { name: "file", level: "file", description: "file", context: [] },
  { name: "function", level: "syntax", description: "function", context: [] },
  { name: "test", level: "framework", description: "test", context: [] },
];
const languages = [
  {
    id: "typescript",
    extensions: [".ts"],
    grammar: { package: "tree-sitter-typescript", wasm: "x.wasm" },
    scopes: ["program"],
    marker: "/* {ref} */",
  },
];

function queryFile(kind: string, name: string, unit: string) {
  return compileQueryFile(
    {
      version: 1,
      kind,
      name,
      definitions: [
        { languages: ["typescript"], units: { [unit]: { query: "(_) @unit" } } },
      ],
    },
    `${name}.yaml`,
  );
}

describe("unitカタログ", () => {
  test("同梱カタログは語彙の全unitを少なくとも1言語で抽出できる", async () => {
    const catalog = await loadUnitCatalog();

    expect([...catalog.units.keys()].sort()).toEqual([
      "comment",
      "component",
      "doc-comment",
      "file",
      "function",
      "hook",
      "setup",
      "statement",
      "teardown",
      "test",
      "test-group",
      "test-group-title",
      "test-title",
      "variable",
    ]);

    for (const unit of catalog.units.keys()) {
      expect(catalog.languagesFor(unit).length).toBeGreaterThan(0);
    }
  });

  test("拡張子からファイルの言語を決める", async () => {
    const catalog = await loadUnitCatalog();

    expect(catalog.languageFor("a/b.test.tsx")?.id).toBe("tsx");
    expect(catalog.languageFor("a/b.test.ts")?.id).toBe("typescript");
    expect(catalog.languageFor("a/b.mjs")?.id).toBe("javascript");
    expect(catalog.languageFor("a/b.py")).toBeUndefined();
  });

  test("語彙にないunitの定義はエラーにする", () => {
    expect(
      () =>
        new UnitCatalog({
          units: vocabulary,
          languages,
          definitions: queryFile("framework", "vitest", "unknown"),
        }),
    ).toThrow("語彙にないunit");
  });

  test("汎用unitをフレームワーク定義で上書きできない", () => {
    expect(
      () =>
        new UnitCatalog({
          units: vocabulary,
          languages,
          definitions: queryFile("framework", "vitest", "function"),
        }),
    ).toThrow("level: syntax");
  });

  test("同じ言語で同じunitを複数のフレームワークが定義するとエラーにする", () => {
    expect(
      () =>
        new UnitCatalog({
          units: vocabulary,
          languages,
          definitions: [
            ...queryFile("framework", "vitest", "test"),
            ...queryFile("framework", "jest", "test"),
          ],
        }),
    ).toThrow("定義が重複しています");
  });

  test("指摘位置のcaptureを持たないqueryはエラーにする", () => {
    expect(
      () =>
        new UnitCatalog({
          units: [
            ...vocabulary,
            {
              name: "variable",
              level: "syntax",
              description: "variable",
              context: [],
              report: "name",
            },
          ],
          languages,
          definitions: queryFile("syntax", "typescript", "variable"),
        }),
    ).toThrow("@name");
  });

  test("@unit captureのないqueryはエラーにする", () => {
    expect(() =>
      compileQueryFile(
        {
          version: 1,
          kind: "framework",
          name: "vitest",
          definitions: [
            { languages: ["typescript"], units: { test: { query: "(_) @x" } } },
          ],
        },
        "vitest.yaml",
      ),
    ).toThrow("@unit");
  });
});

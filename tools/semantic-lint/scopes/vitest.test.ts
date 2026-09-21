import { describe, expect, test } from "bun:test";

import { ScopeRegistry } from "./registry.ts";
import { loadTypeScript, registerVitestScopes } from "./vitest.ts";

describe("Vitest scope adapter", () => {
  test("ASTからtest / describe / beforeEachをrange付きで抽出する", async () => {
    const ts = await loadTypeScript(process.cwd());
    const registry = new ScopeRegistry();
    registerVitestScopes(registry, ts);
    const document = {
      path: "frontend/example.test.ts",
      source: `describe("対象", () => {
  beforeEach(() => {
    prepare();
  });

  test("通常のケースこと", () => {
    act();
  });

  test.each([
    [1],
    [2],
  ])("入力 %s を扱うこと", (value) => {
    act(value);
  });
});
`,
    };

    const tests = registry.extract("vitest.test", document);
    const hooks = registry.extract("vitest.beforeEach", document);
    const describes = registry.extract("vitest.describe", document);

    expect(tests.map((subject) => subject.symbol)).toEqual([
      'test("通常のケースこと")',
      'test("入力 %s を扱うこと")',
    ]);
    expect(tests.map((subject) => subject.range.startLine)).toEqual([6, 10]);
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.symbol).toBe("beforeEach");
    expect(hooks[0]?.range.startLine).toBe(2);
    expect(describes).toHaveLength(1);
    expect(describes[0]?.symbol).toBe('describe("対象")');
    expect(describes[0]?.range.startLine).toBe(1);
  });

  test("comment・文字列・member methodのtestを誤認しない", async () => {
    const ts = await loadTypeScript(process.cwd());
    const registry = new ScopeRegistry();
    registerVitestScopes(registry, ts);
    const document = {
      path: "frontend/example.test.ts",
      source: `// test("comment", () => {});
const source = 'test("string", () => {})';
object.test("member", () => {});

test("本物こと", () => {
  expect(source).toBeTruthy();
});
`,
    };

    const tests = registry.extract("vitest.test", document);

    expect(tests).toHaveLength(1);
    expect(tests[0]?.symbol).toBe('test("本物こと")');
    expect(tests[0]?.range.startLine).toBe(5);
  });
});

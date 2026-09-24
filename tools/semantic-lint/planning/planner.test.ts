import { describe, expect, test } from "bun:test";

import type { SourceDocument } from "../domain/model.ts";
import { sampleRule, testExtractor } from "../testing/fixtures.ts";
import { buildEvaluationPlan } from "./planner.ts";

const extractor = await testExtractor();

const nestedTests: SourceDocument = {
  path: "frontend/example.test.ts",
  source: `describe("合計", () => {
  beforeEach(() => {
    reset();
  });

  test("a", () => {});

  describe("入れ子", () => {
    test("b", () => {});
  });
});

test("c", () => {});
`,
};

describe("buildEvaluationPlan", () => {
  test("ruleをunitごとのtaskへ展開する", () => {
    const plan = buildEvaluationPlan({
      documents: [nestedTests],
      rules: [sampleRule({ id: "vitest/active", unit: "test" })],
      extractor,
      matchesPath: () => true,
    });

    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]?.units.map((unit) => unit.symbol)).toEqual([
      'test("a")',
      'test("b")',
      'test("c")',
    ]);
    expect(plan.files[0]?.tasks.map((task) => task.id)).toEqual([
      "vitest/active::test:frontend/example.test.ts:0",
      "vitest/active::test:frontend/example.test.ts:1",
      "vitest/active::test:frontend/example.test.ts:2",
    ]);
  });

  test("複数ruleのunitを入れ子の親とカタログの文脈で結ぶ", () => {
    const plan = buildEvaluationPlan({
      documents: [nestedTests],
      rules: [
        sampleRule({ id: "vitest/test", unit: "test" }),
        sampleRule({ id: "vitest/group", unit: "test-group" }),
        sampleRule({ id: "vitest/setup", unit: "setup" }),
      ],
      extractor,
      matchesPath: () => true,
    });
    const units = plan.files[0]?.units ?? [];
    const bySymbol = new Map(units.map((unit) => [unit.symbol, unit]));
    const idOf = (symbol: string) => bySymbol.get(symbol)?.id ?? "";

    expect(units.map((unit) => unit.symbol)).toEqual([
      'describe("合計")',
      "beforeEach",
      'test("a")',
      'describe("入れ子")',
      'test("b")',
      'test("c")',
    ]);
    expect(bySymbol.get('test("b")')?.parentId).toBe(idOf('describe("入れ子")'));
    expect(bySymbol.get('test("c")')?.parentId).toBeUndefined();
    expect(bySymbol.get('test("b")')?.contextIds).toEqual([idOf("beforeEach")]);
    expect(bySymbol.get('test("c")')?.contextIds).toEqual([]);
    expect(bySymbol.get("beforeEach")?.contextIds).toEqual([
      idOf('test("a")'),
      idOf('test("b")'),
    ]);
    expect(plan.files[0]?.tasks).toHaveLength(6);
  });

  test("unit直下の文と直下の子unitを違反箇所の候補にする", () => {
    const document: SourceDocument = {
      path: "frontend/parts.test.ts",
      source: `describe("合計", () => {
  const values = [1, 2];

  beforeEach(() => {
    reset();
  });

  test("a", () => {
    const input = build(() => {
      return 1;
    });

    if (input) {
      run(input);
    }
    expect(sum(values)).toBe(3);
  });
});
`,
    };
    const plan = buildEvaluationPlan({
      documents: [document],
      rules: [
        sampleRule({ id: "vitest/test", unit: "test" }),
        sampleRule({ id: "vitest/group", unit: "test-group" }),
        sampleRule({ id: "vitest/setup", unit: "setup" }),
      ],
      extractor,
      matchesPath: () => true,
    });
    const units = plan.files[0]?.units ?? [];
    const partsOf = (symbol: string) =>
      units
        .find((unit) => unit.symbol === symbol)
        ?.parts.map((part) => [
          part.kind,
          part.range.startLine,
          part.range.endLine,
        ]);

    expect(partsOf('describe("合計")')).toEqual([
      ["statement", 2, 2],
      ["unit", 4, 6],
      ["unit", 8, 17],
    ]);
    // 入れ子のblockやcallbackの中の文は候補にしない。
    expect(partsOf('test("a")')).toEqual([
      ["statement", 9, 11],
      ["statement", 13, 15],
      ["statement", 16, 16],
    ]);
    expect(partsOf("beforeEach")).toEqual([["statement", 5, 5]]);
  });
});

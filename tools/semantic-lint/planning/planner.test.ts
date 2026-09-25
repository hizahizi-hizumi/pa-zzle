import { describe, expect, test } from "bun:test";

import type { PlannedUnit, Rule, SourceDocument } from "../domain/model.ts";
import { sampleRule, testExtractor } from "../testing/fixtures.ts";
import { buildEvaluationPlan, bunGlobPathMatcher } from "./planner.ts";

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

  test("指摘位置を宣言したunitはその位置を持ち、partを持たず他のunitのpartにもならない", () => {
    const document: SourceDocument = {
      path: "frontend/report.test.ts",
      source: `describe("合計", () => {
  const values = [1, 2];

  test("空の場合に0を返すこと", () => {
    const input = build(values);

    expect(sum(input)).toBe(0);
  });
});
`,
    };
    const rules = [
      sampleRule({ id: "vitest/test", unit: "test" }),
      sampleRule({ id: "vitest/group", unit: "test-group" }),
    ];
    const partsOf = (units: PlannedUnit[], symbol: string) =>
      units
        .find((unit) => unit.symbol === symbol)
        ?.parts.map((part) => [part.kind, part.range.startLine, part.range.endLine]);
    const plan = (extra: Rule[]) =>
      buildEvaluationPlan({
        documents: [document],
        rules: [...rules, ...extra],
        extractor,
        matchesPath: () => true,
      }).files[0]?.units ?? [];
    const withoutReported = plan([]);
    const withReported = plan([
      sampleRule({ id: "naming/variable", unit: "variable" }),
      sampleRule({ id: "vitest/title", unit: "test-title" }),
    ]);

    for (const symbol of ['describe("合計")', 'test("空の場合に0を返すこと")']) {
      expect(partsOf(withReported, symbol)).toEqual(
        partsOf(withoutReported, symbol),
      );
    }

    const reported = withReported
      .filter((unit) => unit.reportRange !== undefined)
      .map((unit) => ({
        unit: unit.unit,
        symbol: unit.symbol,
        report: unit.reportRange,
        parts: unit.parts.length,
      }));

    expect(reported).toEqual([
      {
        unit: "variable",
        symbol: "values",
        report: { startLine: 2, startColumn: 9, endLine: 2, endColumn: 15 },
        parts: 0,
      },
      {
        unit: "test-title",
        symbol: undefined,
        report: { startLine: 4, startColumn: 8, endLine: 4, endColumn: 21 },
        parts: 0,
      },
      {
        unit: "variable",
        symbol: "input",
        report: { startLine: 5, startColumn: 11, endLine: 5, endColumn: 16 },
        parts: 0,
      },
    ]);
  });
});

describe("bunGlobPathMatcher", () => {
  const rule = {
    paths: ["frontend/src/**/*.tsx"],
    exclude: ["frontend/src/components/ui/**"],
  };

  test.each([
    ["pathsに一致しexcludeに一致しないpath", "frontend/src/views/HomeView.tsx", true],
    ["excludeに一致するpath", "frontend/src/components/ui/button.tsx", false],
    ["pathsに一致しないpath", "frontend/src/games/score.ts", false],
  ])("%sの対象判定を%sにする", (_, path, expected) => {
    const result = bunGlobPathMatcher(rule, path);

    expect(result).toBe(expected);
  });

  test("excludeに一致するfileのtaskを作らない", () => {
    const plan = buildEvaluationPlan({
      documents: [
        { path: "frontend/src/views/HomeView.tsx", source: "" },
        { path: "frontend/src/components/ui/button.tsx", source: "" },
      ],
      rules: [sampleRule({ id: "react/sample", ...rule })],
      extractor,
      matchesPath: bunGlobPathMatcher,
    });

    expect(plan.files.map((file) => file.path)).toEqual([
      "frontend/src/views/HomeView.tsx",
    ]);
  });
});

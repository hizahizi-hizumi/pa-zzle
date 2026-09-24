import { describe, expect, test } from "bun:test";

import { DEFAULT_UNIT_OPTIONS } from "./model.ts";
import { createDefaultUnitRegistry } from "./registry.ts";

const source = `import { helper } from "./helper";

function build(value: number) {
  return [value].map((item) => item + 1);
}

describe("対象", () => {
  const input = 1;

  it("値を返すこと", () => {
    const result = build(input);

    expect(result).toEqual([2]);
  });

  const act = () => build(input);
});

class Store {
  save(value: number) {
    helper(value);
  }
}
`;
const document = { path: "frontend/example.test.ts", source };

describe("function unit", () => {
  test("関数の名前ではなく構文だけで関数本体を単位にする", () => {
    const units = createDefaultUnitRegistry().build(document, ["function"]);

    expect(
      units.units.map((unit) => [unit.span.startLine, unit.span.endLine]),
    ).toEqual([
      [3, 5],
      [7, 17],
      [10, 14],
      [20, 22],
    ]);
  });

  test("foldでは短い関数を外側の単位に畳み、allでは全関数を単位にする", () => {
    const all = createDefaultUnitRegistry().build(document, ["function"], {
      ...DEFAULT_UNIT_OPTIONS,
      nesting: "all",
    });

    expect(all.units.map((unit) => unit.span.startLine)).toEqual([
      3, 4, 7, 10, 16, 20,
    ]);
  });

  test("入れ子の単位は最も近い外側の単位をparentに持ち、外側を畳んだ文脈を参照する", () => {
    const built = createDefaultUnitRegistry().build(document, ["function"]);
    const describeUnit = built.units[1];
    const itUnit = built.units[2];

    expect(itUnit?.parentId).toBe(describeUnit?.id);
    expect(itUnit?.contextIds).toHaveLength(1);

    const context = built.contexts.find(
      (candidate) => candidate.id === itUnit?.contextIds[0],
    );

    expect(context?.source).toContain(" 8|   const input = 1;");
    expect(context?.source).toContain("(lines 11-13 folded)");
    expect(context?.source).not.toContain("expect(result)");
  });

  test("位置特定の展開先は関数本体の直下の文にする", () => {
    const built = createDefaultUnitRegistry().build(document, ["function"]);

    expect(built.units[1]?.locateTargets).toEqual([
      { startLine: 8, endLine: 8 },
      { startLine: 10, endLine: 14 },
      { startLine: 16, endLine: 16 },
    ]);
    expect(built.units[2]?.locateTargets).toEqual([
      { startLine: 11, endLine: 11 },
      { startLine: 13, endLine: 13 },
    ]);
  });

  test("file文脈ではすべての単位がファイル全文を参照する", () => {
    const built = createDefaultUnitRegistry().build(document, ["function"], {
      ...DEFAULT_UNIT_OPTIONS,
      contextMode: "file",
    });

    expect(built.contexts).toHaveLength(1);
    expect(built.units.every((unit) => unit.contextIds[0] === "c0")).toBe(true);
  });
});

describe("line unit", () => {
  test("他の文を含まない文を単位にし、import宣言を除く", () => {
    const built = createDefaultUnitRegistry().build(document, ["line"]);

    expect(built.units.map((unit) => unit.span.startLine)).toEqual([
      4, 8, 11, 13, 16, 21,
    ]);
    expect(built.units.every((unit) => unit.locateTargets.length === 0)).toBe(
      true,
    );
  });

  test("直近の関数の全文と外側の畳んだ本文を文脈にする", () => {
    const built = createDefaultUnitRegistry().build(document, ["line"]);
    const statement = built.units.find((unit) => unit.span.startLine === 11);
    const texts = statement?.contextIds.map(
      (id) => built.contexts.find((context) => context.id === id)?.source,
    );

    expect(texts).toHaveLength(2);
    expect(texts?.[0]).toContain("folded");
    expect(texts?.[1]).toContain("expect(result).toEqual([2]);");
  });
});

describe("syntactic position", () => {
  test("関数が渡される呼び出しと、文を直接囲む関数を構文だけで説明する", () => {
    const options = { ...DEFAULT_UNIT_OPTIONS, syntacticPosition: true };
    const functions = createDefaultUnitRegistry().build(
      document,
      ["function"],
      options,
    );
    const lines = createDefaultUnitRegistry().build(document, ["line"], options);

    expect(functions.units[0]?.position).toBeUndefined();
    expect(functions.units[2]?.position).toBe(
      'passed as an argument to the call starting at line 10: it("値を返すこと", () => {',
    );
    expect(
      lines.units.find((unit) => unit.span.startLine === 11)?.position,
    ).toStartWith("directly inside the function at lines 10-14");
    expect(
      lines.units.find((unit) => unit.span.startLine === 8)?.position,
    ).toContain("call starting at line 7");
  });
});

describe("file unit", () => {
  test("上限以下のファイルは1単位にし、葉の文を位置特定の展開先にする", () => {
    const built = createDefaultUnitRegistry().build(document, ["file"]);

    expect(built.units).toHaveLength(1);
    expect(built.units[0]?.span).toEqual({ startLine: 1, endLine: 24 });
    expect(built.units[0]?.locateTargets).toHaveLength(6);
  });

  test("上限を超えるファイルはトップレベル文の境界で分割する", () => {
    const built = createDefaultUnitRegistry().build(document, ["file"], {
      ...DEFAULT_UNIT_OPTIONS,
      maxFileLines: 12,
    });

    expect(built.units.map((unit) => unit.span)).toEqual([
      { startLine: 1, endLine: 5 },
      { startLine: 7, endLine: 17 },
      { startLine: 19, endLine: 23 },
    ]);
  });
});

describe("outline", () => {
  test("import全文とトップレベル文の先頭行を並べる", () => {
    const built = createDefaultUnitRegistry().build(document, ["function"]);

    expect(built.outline).toContain('import { helper } from "./helper";');
    expect(built.outline).toContain(
      'describe("対象", () => { … (through line 17)',
    );
    expect(built.outline).not.toContain("expect(result)");
  });
});

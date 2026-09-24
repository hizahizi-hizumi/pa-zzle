import { beforeAll, describe, expect, test } from "bun:test";

import { UnitExtractor, decodeQuotedLiteral } from "./extract.ts";

let extractor: UnitExtractor;

beforeAll(async () => {
  extractor = await UnitExtractor.create();
});

function extract(path: string, source: string, unit: string) {
  return (extractor.extract({ path, source }, [unit]).get(unit) ?? []).map(
    (item) => ({
      symbol: item.symbol,
      text: source.slice(item.start, item.end),
    }),
  );
}

const vitestSource = `import { describe, expect, test } from "vitest";

afterEach(cleanup);

describe("合計", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("足す", () => {
    expect(sum(1, 2)).toBe(3);
  });

  test.each([[1, 1]])("%i を返す", (input, expected) => {
    expect(sum(input, 0)).toBe(expected);
  });

  it.skip(\`保留\`, () => {});

  test(\`動的 \${name}\`, () => {});

  test(title, () => {});

  describe.each([1])("入れ子 %i", () => {
    afterAll(() => {});
  });
});
`;

describe("vitestの名前付きunit", () => {
  test("testはtest / itの呼び出しをtest.eachを含めて抽出する", () => {
    expect(extract("a.test.ts", vitestSource, "test")).toEqual([
      {
        symbol: 'test("足す")',
        text: 'test("足す", () => {\n    expect(sum(1, 2)).toBe(3);\n  })',
      },
      {
        symbol: 'test("%i を返す")',
        text: 'test.each([[1, 1]])("%i を返す", (input, expected) => {\n    expect(sum(input, 0)).toBe(expected);\n  })',
      },
      { symbol: 'test("保留")', text: "it.skip(`保留`, () => {})" },
    ]);
  });

  test("test-groupはdescribe.eachを含むdescribeの呼び出しを抽出する", () => {
    expect(
      extract("a.test.ts", vitestSource, "test-group").map((item) => item.symbol),
    ).toEqual(['describe("合計")', 'describe("入れ子 %i")']);
  });

  test("setupは前準備と後始末の呼び出しを抽出する", () => {
    expect(extract("a.test.ts", vitestSource, "setup")).toEqual([
      { symbol: "afterEach", text: "afterEach(cleanup)" },
      {
        symbol: "beforeEach",
        text: "beforeEach(() => {\n    vi.useFakeTimers();\n  })",
      },
      { symbol: "afterAll", text: "afterAll(() => {})" },
    ]);
  });

  test("TSXとJavaScriptでも同じ定義で抽出する", () => {
    const source = 'test("描画", () => { render(<App />); });\n';

    expect(extract("a.test.tsx", source, "test")).toHaveLength(1);
    expect(extract("a.test.mjs", source, "test")).toHaveLength(1);
  });
});

describe("Reactの名前付きunit", () => {
  const source = `export function Panel() {
  return <section />;
}

const Card = memo(() => <div />);

function Helper() {
  return 1;
}

export function useCounter() {
  return useState(0);
}

const useToggle = () => useState(false);
`;

  test("componentは大文字で始まりJSXを含む関数を抽出する", () => {
    expect(
      extract("a.tsx", source, "component").map((item) => item.symbol),
    ).toEqual(["Panel", "Card"]);
  });

  test("hookはuseで始まる関数を抽出する", () => {
    expect(extract("a.tsx", source, "hook").map((item) => item.symbol)).toEqual(
      ["useCounter", "useToggle"],
    );
  });

  test("JSXを書けない言語ではcomponentを抽出しない", () => {
    expect(extract("a.ts", "function Panel() { return 1; }\n", "component"))
      .toEqual([]);
  });
});

describe("汎用unit", () => {
  const source = `import { a } from "a";

export function outer(value: number) {
  const inner = () => value;
  if (value > 0) {
    return inner();
  }
  return 0;
}
`;

  test("fileはファイル全体を1つのunitにする", () => {
    expect(extract("a.ts", source, "file")).toEqual([
      { symbol: "a.ts", text: source },
    ]);
  });

  test("未知の言語でもfileを抽出できる", () => {
    expect(extract("a.md", "# title\n", "file")).toHaveLength(1);
    expect(extract("a.md", "# title\n", "function")).toEqual([]);
  });

  test("functionは宣言とarrow functionを抽出する", () => {
    expect(extract("a.ts", source, "function")).toEqual([
      {
        symbol: "outer",
        text: source.slice(source.indexOf("function outer"), source.lastIndexOf("}") + 1),
      },
      { symbol: "inner", text: "() => value" },
    ]);
  });

  test("statementはブロック直下の文を入れ子ごとに抽出する", () => {
    expect(extract("a.ts", source, "statement").map((item) => item.text)).toEqual(
      [
        'import { a } from "a";',
        source.slice(source.indexOf("export"), source.lastIndexOf("}") + 1),
        "const inner = () => value;",
        "if (value > 0) {\n    return inner();\n  }",
        "return inner();",
        "return 0;",
      ],
    );
  });
});

describe("decodeQuotedLiteral", () => {
  test.each([
    ['"a\\"b"', 'a"b'],
    ["'it\\'s'", "it's"],
    ["`x\\u0041\\x42`", "xAB"],
    ['"\\u{1F600}"', "\u{1F600}"],
  ])("%s の値を返す", (text, expected) => {
    expect(decodeQuotedLiteral(text)).toBe(expected);
  });

  test("引用符で囲まれていなければundefinedを返す", () => {
    expect(decodeQuotedLiteral("name")).toBeUndefined();
  });
});

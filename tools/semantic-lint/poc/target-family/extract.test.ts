import { describe, expect, test } from "bun:test";

import {
  extractCallbackCallCandidates,
  extractCallbackStatementCandidates,
} from "./extract.ts";

describe("target family extractors", () => {
  test("call callback直下のstatementを汎用targetとして抽出する", () => {
    const candidates = extractCallbackStatementCandidates({
      path: "example.test.ts",
      source: `describe("sum", () => {\n  test("合計", () => {\n    const values = [1, 2, 3];\n    const result = sum(values);\n    expect(result).toBe(6);\n  });\n});\n`,
    });
    const testStatements = candidates.filter(
      (candidate) => candidate.context.call?.callee === "test",
    );

    expect(testStatements.map((candidate) => candidate.source)).toEqual([
      "const values = [1, 2, 3];",
      "const result = sum(values);",
      "expect(result).toBe(6);",
    ]);
    expect(testStatements[0]?.context.enclosingCalls).toEqual([
      "test",
      "describe",
    ]);
  });

  test("callbackを持つcall全体を汎用targetとして抽出する", () => {
    const candidates = extractCallbackCallCandidates({
      path: "example.test.ts",
      source: `describe("form", () => {\n  beforeEach(() => {\n    prepare();\n  });\n\n  test("送信", () => {\n    submit();\n  });\n});\n`,
    });

    expect(candidates.map((candidate) => candidate.label)).toEqual([
      "callback(describe)",
      "callback(beforeEach)",
      "callback(test)",
    ]);
    expect(candidates[1]?.source).toContain("beforeEach(() =>");
    expect(candidates[1]?.context.call).toEqual({
      callee: "beforeEach",
      callbackArgumentIndex: 0,
    });
  });
});

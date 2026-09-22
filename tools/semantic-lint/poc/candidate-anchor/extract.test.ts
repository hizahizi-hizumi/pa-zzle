import { describe, expect, test } from "bun:test";

import { extractCandidateAnchors } from "./extract.ts";

describe("extractCandidateAnchors", () => {
  const source = 'const hoge = getUser(), users = getUsers();\n';
  const candidates = extractCandidateAnchors({ path: "example.ts", source });

  test("変数宣言を別candidateとして抽出する", () => {
    const labels = candidates.map((candidate) => candidate.label);

    expect(labels).toEqual(["variable(hoge)", "variable(users)"]);
  });

  test("包含するcallをnearest-firstで構造contextへ保持する", () => {
    const nested = extractCandidateAnchors({
      path: "example.test.ts",
      source: `describe("target", () => {
  test("動くこと", () => {
    const value = createValue();
    expect(value).toBeDefined();
  });
});
`,
    });
    const value = nested.find((candidate) => candidate.label === "variable(value)");

    expect(value?.context).toEqual({
      enclosingCalls: ["test", "describe"],
    });
  });

  test("compact state向けにnode・capture・suite pathを保持する", () => {
    const nested = extractCandidateAnchors({
      path: "example.test.ts",
      source: `describe("target", () => {
  test("動くこと", () => {
    const value = createValue();
    expect(value).toBeDefined();
  });
});
`,
    });
    const value = nested.find(
      (candidate) => candidate.label === "variable(value)",
    );

    expect(value?.compactContext).toEqual({
      enclosingCalls: ["test", "describe"],
      nodeKind: "VariableDeclaration",
      enclosingCallDetails: [
        { callee: "test", label: "動くこと" },
        { callee: "describe", label: "target" },
      ],
      captures: {
        name: "value",
        initializerKind: "CallExpression",
        initializerCallee: "createValue",
      },
    });
  });

  test("変数宣言からstatementとnameのanchorを抽出する", () => {
    const candidate = candidates[0];

    expect(candidate?.anchors.map((anchor) => [anchor.role, anchor.source])).toEqual([
      ["self", "hoge = getUser()"],
      ["statement", 'const hoge = getUser(), users = getUsers();'],
      ["name", "hoge"],
      ["initializer", "getUser()"],
    ]);
  });
});

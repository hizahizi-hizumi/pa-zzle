import { describe, expect, test } from "bun:test";

import { extractSelectedCandidates } from "./selectors.ts";

describe("extractSelectedCandidates", () => {
  const source = 'const hoge = getUser(), users = getUsers();\n';

  test("選択したselectorのnodeだけcandidateにする", () => {
    const candidates = extractSelectedCandidates(
      { path: "example.ts", source },
      new Set(["variable-declaration"]),
    );
    const labels = candidates.map((candidate) => candidate.label);

    expect(labels).toEqual(["variable(hoge)", "variable(users)"]);
  });

  test("変数宣言はnameとstatementをanchorに持つ", () => {
    const [candidate] = extractSelectedCandidates(
      { path: "example.ts", source },
      new Set(["variable-declaration"]),
    );
    const anchors = candidate?.anchors.map((anchor) => [anchor.role, anchor.source]);

    expect(anchors).toEqual([
      ["self", "hoge = getUser()"],
      ["statement", 'const hoge = getUser(), users = getUsers();'],
      ["name", "hoge"],
      ["initializer", "getUser()"],
    ]);
  });

  test("describeはgeneric callと重複せず専用selectorになる", () => {
    const candidates = extractSelectedCandidates(
      {
        path: "example.test.ts",
        source: 'describe("target", () => { test("動くこと", () => {}); });\n',
      },
      new Set(["generic-call-statement", "vitest-describe", "vitest-test"]),
    );

    expect(candidates.map((candidate) => candidate.selectorId)).toEqual([
      "vitest-describe",
      "vitest-test",
    ]);
  });
});

import { describe, expect, test } from "bun:test";

import { extractCandidateAnchors } from "./extract.ts";

describe("extractCandidateAnchors", () => {
  const source = 'const hoge = getUser(), users = getUsers();\n';
  const candidates = extractCandidateAnchors({ path: "example.ts", source });

  test("変数宣言を別candidateとして抽出する", () => {
    const labels = candidates.map((candidate) => candidate.label);

    expect(labels).toEqual(["variable(hoge)", "variable(users)"]);
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

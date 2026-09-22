import { describe, expect, test } from "bun:test";

import { extractLocationGroups } from "./extract.ts";

describe("extractLocationGroups", () => {
  test("変数宣言からstatementとnameを含むanchor群を作る", () => {
    const [group] = extractLocationGroups({
      path: "example.ts",
      source: 'const hoge = getUser(), users = getUsers();\n',
    });

    expect(group?.label).toBe("variable(hoge)");
    expect(group?.anchors.map((anchor) => [anchor.role, anchor.source])).toEqual([
      ["self", "hoge = getUser()"],
      ["statement", 'const hoge = getUser(), users = getUsers();'],
      ["name", "hoge"],
      ["initializer", "getUser()"],
    ]);
  });

  test("describe呼び出し全体をself anchorとして保持する", () => {
    const [group] = extractLocationGroups({
      path: "example.test.ts",
      source: 'describe("target", () => { test("動くこと", () => {}); });\n',
    });

    expect(group?.label).toBe("call(describe)");
    expect(group?.anchors[0]?.source).toBe(
      'describe("target", () => { test("動くこと", () => {}); });',
    );
  });
});

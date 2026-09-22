import { describe, expect, test } from "bun:test";

import { extractRelationGroupCandidates } from "./extract.ts";

describe("extractRelationGroupCandidates", () => {
  test("リテラルだけが異なる同構造statementをrelationとして抽出する", () => {
    const groups = extractRelationGroupCandidates({
      path: "example.ts",
      source: `function calculate(value: number) {
  const first = transform(1);
  const second = transform(2);
  return first + second;
}
`,
    });
    const functionBody = groups.find(
      (group) => group.context.relation?.containerKind === "Block",
    );

    expect(functionBody?.context.relation?.kind).toBe("siblings");
    expect(functionBody?.context.relation?.memberKinds).toHaveLength(2);
    expect(functionBody?.context.relation?.memberKinds[0]).toBe(
      functionBody?.context.relation?.memberKinds[1],
    );
    expect(functionBody?.source).toContain("const first = transform(1);");
    expect(functionBody?.source).toContain("const second = transform(2);");
    expect(functionBody?.source).not.toContain("return first + second;");
  });

  test("異なるcallの隣接statementはgroupにしない", () => {
    const groups = extractRelationGroupCandidates({
      path: "example.ts",
      source: `register(() => {
  prepare();
  execute();
  verify();
});
`,
    });

    expect(groups).toHaveLength(0);
  });

  test("同じcallの隣接statementは包含statementを位置候補に持つ", () => {
    const groups = extractRelationGroupCandidates({
      path: "example.ts",
      source: `register(() => {
  process(1);
  process(2);
});
`,
    });
    const callbackBody = groups[0];

    expect(callbackBody?.context.enclosingCalls).toEqual(["register"]);
    expect(
      callbackBody?.anchors.find(
        (anchor) => anchor.role === "enclosing-statement",
      )?.source,
    ).toBe(`register(() => {
  process(1);
  process(2);
});`);
  });
});

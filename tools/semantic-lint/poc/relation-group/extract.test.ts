import { describe, expect, test } from "bun:test";

import { extractRelationGroupCandidates } from "./extract.ts";

describe("extractRelationGroupCandidates", () => {
  test("同じ構文コンテナ直下のstatement群を汎用relationとして抽出する", () => {
    const groups = extractRelationGroupCandidates({
      path: "example.ts",
      source: `function calculate(value: number) {
  const first = transform(value);
  const second = transform(value + 1);
  return first + second;
}
`,
    });
    const functionBody = groups.find(
      (group) => group.context.relation?.memberKinds.length === 3,
    );

    expect(functionBody?.context.relation?.kind).toBe("siblings");
    expect(functionBody?.context.relation?.containerKind).toBe("Block");
    expect(functionBody?.context.relation?.memberKinds).toHaveLength(3);
    expect(functionBody?.source).toContain("const first = transform(value);");
    expect(functionBody?.source).toContain("return first + second;");
  });

  test("groupの位置候補に汎用的な包含statementを保持する", () => {
    const groups = extractRelationGroupCandidates({
      path: "example.ts",
      source: `register(() => {
  stepOne();
  stepTwo();
});
`,
    });
    const callbackBody = groups.find((group) =>
      group.anchors.some((anchor) => anchor.role === "enclosing-statement"),
    );

    expect(callbackBody?.context.enclosingCalls).toEqual(["register"]);
    expect(
      callbackBody?.anchors.find(
        (anchor) => anchor.role === "enclosing-statement",
      )?.source,
    ).toBe(`register(() => {
  stepOne();
  stepTwo();
});`);
  });
});

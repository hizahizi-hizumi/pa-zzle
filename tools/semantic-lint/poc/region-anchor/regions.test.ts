import { describe, expect, test } from "bun:test";

import { extractLocationGroups } from "./extract.ts";
import { extractSemanticRegions } from "./regions.ts";

describe("extractSemanticRegions", () => {
  test("test内の構文はtest regionへ、describe直下はdescribe regionへ割り当てる", () => {
    const document = {
      path: "example.test.ts",
      source: `describe("sum", () => {
  const outside = [1, 2, 3];

  test("合計を返すこと", () => {
    const inside = [1, 2, 3];
    expect(sum(inside)).toBe(6);
  });
});
`,
    };
    const groups = extractLocationGroups(document);
    const regions = extractSemanticRegions(document, groups);
    const describeRegion = regions.find(
      (region) => region.kind === "vitest-describe",
    );
    const testRegion = regions.find((region) => region.kind === "vitest-test");

    expect(describeRegion?.groups.map((group) => group.label)).toContain(
      "variable(outside)",
    );
    expect(testRegion?.groups.map((group) => group.label)).toContain(
      "variable(inside)",
    );
  });

  test("describe呼び出し自身はdescribe regionへ所属する", () => {
    const document = {
      path: "example.test.ts",
      source: 'describe("target", () => { test("動くこと", () => {}); });\n',
    };
    const groups = extractLocationGroups(document);
    const regions = extractSemanticRegions(document, groups);
    const describeRegion = regions.find(
      (region) => region.kind === "vitest-describe",
    );

    expect(describeRegion?.groups.map((group) => group.label)).toContain(
      "call(describe)",
    );
  });
});

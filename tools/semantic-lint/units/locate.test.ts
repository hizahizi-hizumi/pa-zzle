import { describe, expect, test } from "bun:test";

import { decisionCacheKey } from "./cache.ts";
import { dedupeNestedFindings } from "./dedupe.ts";
import {
  locateWindows,
  MAX_CHOICES,
  NONE_CHOICE,
  selectLocations,
  windowCriteria,
} from "./locate.ts";
import type { Unit } from "./model.ts";

const lines = [
  "test(\"a\", () => {",
  "  const board = createBoard();",
  "",
  "  // comment",
  "  render(",
  "    <Board board={board} />",
  "  );",
  "  expect(screen.getByText(\"x\")).toBeTruthy();",
  "});",
];

function unitWith(targets: Unit["locateTargets"]): Unit {
  return {
    id: "function:a.test.tsx:0",
    kind: "function",
    path: "a.test.tsx",
    span: { startLine: 1, endLine: 9 },
    symbol: 'test("a", () => {',
    source: "",
    locateTargets: targets,
    contextIds: [],
  };
}

const unit = unitWith([
  { startLine: 2, endLine: 2 },
  { startLine: 5, endLine: 7 },
  { startLine: 8, endLine: 8 },
]);

describe("locateWindows", () => {
  test("空行・コメント行・記号だけの行を除いた行IDを候補にする", () => {
    const windows = locateWindows(unit, lines, "lines");

    expect(windows).toHaveLength(1);
    expect(Object.keys(windowCriteria(windows[0] ?? {
      candidates: [],
      allowsNone: false,
    }))).toEqual(["L2", "L5", "L6", "L8"]);
  });

  test("statementsでは文の先頭行だけを候補にする", () => {
    const windows = locateWindows(unit, lines, "statements");

    expect(windows[0]?.candidates.map((candidate) => candidate.key)).toEqual([
      "L2",
      "L5",
      "L8",
    ]);
    expect(windows[0]?.candidates[1]?.text).toBe("render( …");
  });

  test("選択肢が上限を超えたらNONE付きのwindowに分ける", () => {
    const manyLines = Array.from({ length: 600 }, (_, index) => `call${index}();`);
    const manyTargets = manyLines.map((_, index) => ({
      startLine: index + 1,
      endLine: index + 1,
    }));
    const windows = locateWindows(unitWith(manyTargets), manyLines, "lines");

    expect(windows).toHaveLength(3);
    expect(
      windows.every(
        (window) =>
          Object.keys(windowCriteria(window)).length <= MAX_CHOICES &&
          window.allowsNone,
      ),
    ).toBe(true);
  });
});

describe("selectLocations", () => {
  test("複数行の文は行の確率を合算し、最有力候補に近い文をすべて選ぶ", () => {
    const windows = locateWindows(unit, lines, "lines");
    const locations = selectLocations(unit, windows, [
      {
        choice: "L2",
        probabilities: { L2: 0.4, L5: 0.15, L6: 0.15, L8: 0.05 },
      },
    ]);

    expect(locations).toEqual([
      { startLine: 2, endLine: 2 },
      { startLine: 5, endLine: 7 },
    ]);
  });

  test("NONEを選んだwindowからは指摘しない", () => {
    const windows = locateWindows(unit, lines, "lines").map((window) => ({
      ...window,
      allowsNone: true,
    }));
    const locations = selectLocations(unit, windows, [
      { choice: NONE_CHOICE, probabilities: { [NONE_CHOICE]: 0.9, L2: 0.1 } },
    ]);

    expect(locations).toEqual([unit.span]);
  });

  test("位置特定の候補がない単位は単位全体を指摘範囲にする", () => {
    expect(selectLocations(unitWith([]), [], [])).toEqual([unit.span]);
  });
});

describe("dedupeNestedFindings", () => {
  test("内側の指摘を包含する外側の指摘を捨て、同じ範囲を1つにまとめる", () => {
    const findings = dedupeNestedFindings([
      { path: "a", startLine: 10, endLine: 20, from: "parent" },
      { path: "a", startLine: 12, endLine: 12, from: "child" },
      { path: "a", startLine: 12, endLine: 12, from: "duplicate" },
      { path: "a", startLine: 30, endLine: 40, from: "parent-only" },
      { path: "b", startLine: 1, endLine: 50, from: "other-file" },
    ]);

    expect(findings.map((finding) => finding.from)).toEqual([
      "child",
      "parent-only",
      "other-file",
    ]);
  });
});

describe("decisionCacheKey", () => {
  const base = {
    stage: "judge" as const,
    model: "jev-latest",
    rule: {
      instruction: "Determine.",
      outcomes: { violation: "v", compliant: "c" },
    },
    unit: "function",
    contextMode: "skeleton",
    target: "1| code",
    context: ["outline"],
  };

  test("rule文面・unit・文脈モード・対象・modelが同じなら同じkeyにする", () => {
    expect(decisionCacheKey(base)).toBe(
      decisionCacheKey({
        ...base,
        rule: {
          instruction: "Determine.",
          outcomes: { compliant: "c", violation: "v" },
        },
      }),
    );
  });

  test("判定に影響する素材が変わればkeyを変える", () => {
    const key = decisionCacheKey(base);

    for (const changed of [
      { ...base, model: "jev-next" },
      { ...base, unit: "line" },
      { ...base, contextMode: "file" },
      { ...base, target: "2| code" },
      { ...base, context: ["outline2"] },
      { ...base, rule: { ...base.rule, instruction: "Other." } },
      { ...base, stage: "locate" as const },
    ]) {
      expect(decisionCacheKey(changed)).not.toBe(key);
    }
  });
});

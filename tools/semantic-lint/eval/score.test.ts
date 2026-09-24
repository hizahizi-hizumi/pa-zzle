import { describe, expect, test } from "bun:test";

import type { GoldenSet } from "./golden.ts";
import {
  findingStability,
  findingsAtThreshold,
  scoreFindings,
  summarize,
} from "./score.ts";

const golden: GoldenSet = {
  ruleId: "vitest/sample",
  baseCommit: "0".repeat(40),
  origin: "golden.yaml",
  files: [
    {
      path: "a.test.ts",
      blob: "1".repeat(40),
      findings: [
        { startLine: 10, endLine: 10 },
        { startLine: 12, endLine: 14 },
        { startLine: 30, endLine: 30 },
      ],
    },
    {
      path: "b.test.ts",
      blob: "2".repeat(40),
      findings: [{ startLine: 5, endLine: 5 }],
    },
    {
      path: "clean.test.ts",
      blob: "3".repeat(40),
      findings: [],
    },
  ],
};

describe("scoreFindings", () => {
  test("期待行を包含するsubject全体の指摘を包含一致として数える", () => {
    const score = scoreFindings(
      golden,
      [
        { path: "a.test.ts", startLine: 8, endLine: 20 },
        { path: "clean.test.ts", startLine: 1, endLine: 4 },
      ],
      { lineTolerance: 1 },
    );

    expect(score.containment).toMatchObject({
      expected: 4,
      matchedExpected: 2,
      findings: 2,
      matchedFindings: 1,
      precision: 0.5,
      recall: 0.5,
    });
    expect(score.strict).toMatchObject({
      matchedExpected: 0,
      precision: 0,
      recall: 0,
    });
    expect(score.missedExpected).toEqual([
      { path: "a.test.ts", startLine: 30, endLine: 30 },
      { path: "b.test.ts", startLine: 5, endLine: 5 },
    ]);
    expect(score.falseFindings).toEqual([
      { path: "clean.test.ts", startLine: 1, endLine: 4 },
    ]);
  });

  test("file単位では指摘の有無だけを比較する", () => {
    const score = scoreFindings(
      golden,
      [
        { path: "a.test.ts", startLine: 99, endLine: 99 },
        { path: "clean.test.ts", startLine: 1, endLine: 1 },
      ],
      { lineTolerance: 0 },
    );

    expect(score.files).toEqual({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 1,
      trueNegatives: 0,
      precision: 0.5,
      recall: 0.5,
    });
  });

  test("厳密一致は許容差以内の範囲を1対1で対応付ける", () => {
    const score = scoreFindings(
      golden,
      [
        { path: "a.test.ts", startLine: 10, endLine: 10 },
        { path: "a.test.ts", startLine: 11, endLine: 11 },
        { path: "a.test.ts", startLine: 12, endLine: 15 },
      ],
      { lineTolerance: 1 },
    );

    expect(score.strict).toMatchObject({
      expected: 4,
      matchedExpected: 2,
      findings: 3,
      matchedFindings: 2,
    });
  });

  test("goldenにないファイルの指摘を採点対象から除く", () => {
    const score = scoreFindings(
      golden,
      [{ path: "other.test.ts", startLine: 1, endLine: 1 }],
      { lineTolerance: 1 },
    );

    expect(score.findings).toEqual([]);
    expect(score.containment.precision).toBeNull();
    expect(score.files.precision).toBeNull();
  });
});

describe("findingsAtThreshold", () => {
  test("violation判定かつthreshold以上の確率だけを指摘にする", () => {
    const findings = findingsAtThreshold(
      [
        {
          path: "a.test.ts",
          range: { startLine: 1, endLine: 2 },
          decision: "violation",
          violationProbability: 0.9,
        },
        {
          path: "a.test.ts",
          range: { startLine: 3, endLine: 4 },
          decision: "violation",
          violationProbability: 0.6,
        },
        {
          path: "a.test.ts",
          range: { startLine: 5, endLine: 6 },
          decision: "compliant",
          violationProbability: 0.95,
        },
      ],
      0.7,
    );

    expect(findings).toEqual([
      { path: "a.test.ts", startLine: 1, endLine: 2 },
    ]);
  });
});

describe("summarize", () => {
  test("nullを除いて平均と範囲と標準偏差を求める", () => {
    const summary = summarize([0.5, null, 1]);

    expect(summary).toEqual({
      runs: 3,
      mean: 0.75,
      min: 0.5,
      max: 1,
      stddev: 0.25,
    });
  });
});

describe("findingStability", () => {
  test("一部のrunだけに出た指摘を揺れとして数える", () => {
    const stability = findingStability([
      [
        { path: "a.test.ts", startLine: 1, endLine: 2 },
        { path: "a.test.ts", startLine: 5, endLine: 6 },
      ],
      [{ path: "a.test.ts", startLine: 1, endLine: 2 }],
    ]);

    expect(stability).toEqual({
      distinct: 2,
      stable: 1,
      unstable: [{ path: "a.test.ts", startLine: 5, endLine: 6, runs: 1 }],
    });
  });
});

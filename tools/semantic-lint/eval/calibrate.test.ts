import { describe, expect, test } from "bun:test";

import { calibrate, chooseThreshold } from "./calibrate.ts";
import type { GoldenSet } from "./golden.ts";
import type { ScoredEvaluation } from "./score.ts";

const golden: GoldenSet = {
  ruleId: "vitest/sample",
  baseCommit: "0".repeat(40),
  origin: "golden.yaml",
  files: [
    {
      path: "a.test.ts",
      blob: "1".repeat(40),
      findings: [{ startLine: 3, endLine: 3 }],
    },
    {
      path: "b.test.ts",
      blob: "2".repeat(40),
      findings: [{ startLine: 7, endLine: 7 }],
    },
    { path: "clean.test.ts", blob: "3".repeat(40), findings: [] },
  ],
};

function evaluation(
  path: string,
  line: number,
  violationProbability: number,
): ScoredEvaluation {
  return {
    path,
    range: { startLine: line, endLine: line },
    decision: "violation",
    violationProbability,
  };
}

const runs: ScoredEvaluation[][] = [
  [
    evaluation("a.test.ts", 3, 0.9),
    evaluation("b.test.ts", 7, 0.65),
    evaluation("clean.test.ts", 2, 0.55),
  ],
];

describe("chooseThreshold", () => {
  test("厳密F1が最大になるthresholdの中央を選ぶ", () => {
    const choice = chooseThreshold(golden, runs, {
      lineTolerance: 0,
      grid: [0.5, 0.56, 0.6, 0.64, 0.7],
    });

    expect(choice).toEqual({ threshold: 0.6, f1: 1, containmentF1: 1 });
  });

  test("厳密F1が同点なら包含F1で選ぶ", () => {
    // unit全体は期待行を包含するが、違反箇所の特定が外れて厳密一致しない。
    const located = runs.map((evaluations) =>
      evaluations.map((item) => ({
        ...item,
        range: { startLine: item.range.startLine - 1, endLine: item.range.endLine + 1 },
        parts: [
          {
            kind: "statement" as const,
            range: { startLine: item.range.startLine + 1, endLine: item.range.endLine + 1 },
            probability: 0.9,
          },
        ],
      })),
    );
    const choice = chooseThreshold(golden, located, {
      lineTolerance: 0,
      grid: [0.5, 0.6, 0.7],
    });

    expect(choice).toEqual({ threshold: 0.6, f1: 0, containmentF1: 1 });
  });

  test("期待findingがない集合では誤指摘が出ないthresholdを選ぶ", () => {
    const clean = { ...golden, files: golden.files.slice(2) };
    const choice = chooseThreshold(clean, runs, {
      lineTolerance: 0,
      grid: [0.5, 0.6, 0.7],
    });

    expect(choice.threshold).toBe(0.6);
    expect(choice.f1).toBe(1);
  });
});

describe("calibrate", () => {
  test("gapとheadroomを違反候補とクリーン候補のscoreから求める", () => {
    const calibration = calibrate(golden, runs, {
      lineTolerance: 0,
      grid: [0.5, 0.6, 0.7, 0.8],
    });

    expect(calibration.positives).toBe(2);
    expect(calibration.cleans).toBe(1);
    expect(calibration.threshold).toBe(0.6);
    expect(calibration.gap).toBeCloseTo(0.1);
    expect(calibration.headroom).toBeCloseTo(0.05);
    expect(calibration.recallCeiling).toBe(1);
  });

  test("leave-one-file-outでは評価するファイルを校正から外す", () => {
    const calibration = calibrate(golden, runs, {
      lineTolerance: 0,
      grid: [0.5, 0.6, 0.7, 0.8],
    });
    const cv = calibration.crossValidation;

    expect(cv.folds).toBe(3);
    // b.test.tsを外した校正では0.6〜0.8が同点になり、中央の0.7で0.65のbを取りこぼす。
    expect(cv.containmentRecall.mean).toBe(0.5);
    // clean.test.tsを外した校正では0.5が選ばれ、0.55のクリーン候補を誤指摘する。
    expect(cv.containmentPrecision.mean).toBe(0.5);
  });
});

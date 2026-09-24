import type { GoldenSet } from "./golden.ts";
import {
  type FindingRange,
  findingsAtThreshold,
  type ScoredEvaluation,
  scoreFindings,
  type Summary,
  summarize,
} from "./score.ts";

export const CALIBRATION_GRID: readonly number[] = Array.from(
  { length: 14 },
  (_, index) => Math.round((0.3 + index * 0.05) * 100) / 100,
);

export type ThresholdChoice = {
  threshold: number;
  f1: number;
};

export type CrossValidation = {
  folds: number;
  thresholds: Summary;
  containmentPrecision: Summary;
  containmentRecall: Summary;
  strictPrecision: Summary;
  strictRecall: Summary;
  findings: Summary;
};

export type Calibration = {
  /** 全goldenで校正した推奨threshold。rule定義へ提案する値。 */
  threshold: number;
  f1: number;
  /** 違反群の最低scoreとクリーン群の最高scoreの差。負なら分離できていない。 */
  gap: number | null;
  /** 推奨thresholdから最高クリーンscoreまでの距離。負なら推奨値でも誤指摘が残る。 */
  headroom: number | null;
  positives: number;
  cleans: number;
  /** thresholdを最低にしたときの包含recall。判定で届く上限。 */
  recallCeiling: number | null;
  /** leave-one-file-out。校正に使ったファイルとは別のファイルで採点する。 */
  crossValidation: CrossValidation;
};

/**
 * 包含一致のF1が最大になるthresholdを選ぶ。
 * 同じF1のthresholdが複数あれば、その中央を選んで両群から離す。
 */
export function chooseThreshold(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
  options: { lineTolerance: number; grid?: readonly number[] },
): ThresholdChoice {
  const grid = options.grid ?? CALIBRATION_GRID;
  const scored = grid.map((threshold) => ({
    threshold,
    f1: pooledF1(golden, runs, threshold, options.lineTolerance),
  }));
  const best = Math.max(...scored.map((row) => row.f1));
  const plateau = scored.filter((row) => row.f1 >= best - 1e-9);
  const middle = plateau[Math.floor((plateau.length - 1) / 2)];

  if (!middle) {
    throw new Error("校正gridが空です。");
  }

  return middle;
}

export function calibrate(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
  options: { lineTolerance: number; grid?: readonly number[] },
): Calibration {
  const choice = chooseThreshold(golden, runs, options);
  const { positives, cleans } = candidateScores(golden, runs);
  const maxClean = cleans.length === 0 ? null : Math.max(...cleans);
  const minPositive = positives.length === 0 ? null : Math.min(...positives);
  const ceiling = summarize(
    runs.map(
      (evaluations) =>
        scoreFindings(golden, findingsAtThreshold(evaluations, 0), {
          lineTolerance: options.lineTolerance,
        }).containment.recall,
    ),
  );

  return {
    threshold: choice.threshold,
    f1: choice.f1,
    gap:
      maxClean === null || minPositive === null ? null : minPositive - maxClean,
    headroom: maxClean === null ? null : choice.threshold - maxClean,
    positives: positives.length,
    cleans: cleans.length,
    recallCeiling: ceiling.mean,
    crossValidation: leaveOneFileOut(golden, runs, options),
  };
}

function leaveOneFileOut(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
  options: { lineTolerance: number; grid?: readonly number[] },
): CrossValidation {
  const thresholds: number[] = [];
  const pooled: FindingRange[][] = runs.map(() => []);

  for (const heldOut of golden.files) {
    const calibrationSet = restrict(
      golden,
      (path) => path !== heldOut.path,
    );
    const calibrationRuns = runs.map((evaluations) =>
      evaluations.filter((evaluation) => evaluation.path !== heldOut.path),
    );
    const { threshold } = chooseThreshold(
      calibrationSet,
      calibrationRuns,
      options,
    );
    thresholds.push(threshold);

    runs.forEach((evaluations, index) => {
      pooled[index]?.push(
        ...findingsAtThreshold(
          evaluations.filter((evaluation) => evaluation.path === heldOut.path),
          threshold,
        ),
      );
    });
  }

  const scores = pooled.map((findings) =>
    scoreFindings(golden, findings, { lineTolerance: options.lineTolerance }),
  );

  return {
    folds: golden.files.length,
    thresholds: summarize(thresholds),
    containmentPrecision: summarize(
      scores.map((score) => score.containment.precision),
    ),
    containmentRecall: summarize(
      scores.map((score) => score.containment.recall),
    ),
    strictPrecision: summarize(scores.map((score) => score.strict.precision)),
    strictRecall: summarize(scores.map((score) => score.strict.recall)),
    findings: summarize(scores.map((score) => score.findings.length)),
  };
}

/** 指摘候補を、期待範囲を包含するものとしないものに分けてscoreを集める。 */
function candidateScores(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
): { positives: number[]; cleans: number[] } {
  const expected = golden.files.flatMap((file) =>
    file.findings.map((finding) => ({ path: file.path, ...finding })),
  );
  const goldenPaths = new Set(golden.files.map((file) => file.path));
  const positives: number[] = [];
  const cleans: number[] = [];

  for (const evaluations of runs) {
    for (const evaluation of evaluations) {
      if (
        evaluation.decision !== "violation" ||
        !goldenPaths.has(evaluation.path)
      ) {
        continue;
      }

      const { range } = evaluation;
      const hit = expected.some(
        (finding) =>
          finding.path === evaluation.path &&
          range.startLine <= finding.startLine &&
          range.endLine >= finding.endLine,
      );
      (hit ? positives : cleans).push(evaluation.violationProbability);
    }
  }

  return { positives, cleans };
}

function pooledF1(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
  threshold: number,
  lineTolerance: number,
): number {
  let expected = 0;
  let matchedExpected = 0;
  let findings = 0;
  let matchedFindings = 0;

  for (const evaluations of runs) {
    const score = scoreFindings(
      golden,
      findingsAtThreshold(evaluations, threshold),
      { lineTolerance },
    ).containment;
    expected += score.expected;
    matchedExpected += score.matchedExpected;
    findings += score.findings;
    matchedFindings += score.matchedFindings;
  }

  const precision = findings === 0 ? 1 : matchedFindings / findings;
  const recall = expected === 0 ? 1 : matchedExpected / expected;

  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

function restrict(
  golden: GoldenSet,
  keep: (path: string) => boolean,
): GoldenSet {
  return {
    ...golden,
    files: golden.files.filter((file) => keep(file.path)),
  };
}

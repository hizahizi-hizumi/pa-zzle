import type { GoldenSet } from "./golden.ts";
import {
  containsRange,
  type FindingRange,
  findingRange,
  findingsAtThreshold,
  type ScoredEvaluation,
  scoreFindings,
  scoreLocatedFindings,
  type Summary,
  summarize,
  unitFindingsAtThreshold,
} from "./score.ts";

export const CALIBRATION_GRID: readonly number[] = Array.from(
  { length: 14 },
  (_, index) => Math.round((0.3 + index * 0.05) * 100) / 100,
);

export type ThresholdChoice = {
  threshold: number;
  /** 違反箇所の厳密一致のF1。 */
  f1: number;
  /** unit単位の包含一致のF1。 */
  containmentF1: number;
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
  /** 推奨thresholdでの違反箇所の厳密一致のF1。 */
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
 * 違反箇所の厳密一致のF1が最大になるthresholdを選ぶ。同点ならunit単位の包含一致のF1で比べる。
 * それでも同じthresholdが複数あれば、その中央を選んで両群から離す。
 */
export function chooseThreshold(
  golden: GoldenSet,
  runs: ReadonlyArray<readonly ScoredEvaluation[]>,
  options: { lineTolerance: number; grid?: readonly number[] },
): ThresholdChoice {
  const grid = options.grid ?? CALIBRATION_GRID;
  const scored = grid.map((threshold) => ({
    threshold,
    ...pooledF1(golden, runs, threshold, options.lineTolerance),
  }));
  const best = Math.max(...scored.map((row) => row.f1));
  const strictPlateau = scored.filter((row) => row.f1 >= best - 1e-9);
  const bestContainment = Math.max(
    ...strictPlateau.map((row) => row.containmentF1),
  );
  const plateau = strictPlateau.filter(
    (row) => row.containmentF1 >= bestContainment - 1e-9,
  );
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
        scoreFindings(golden, unitFindingsAtThreshold(evaluations, 0), {
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
  const pooledUnits: FindingRange[][] = runs.map(() => []);

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
      const heldOutEvaluations = evaluations.filter(
        (evaluation) => evaluation.path === heldOut.path,
      );
      pooled[index]?.push(...findingsAtThreshold(heldOutEvaluations, threshold));
      pooledUnits[index]?.push(
        ...unitFindingsAtThreshold(heldOutEvaluations, threshold),
      );
    });
  }

  const scores = pooled.map((located, index) =>
    scoreLocatedFindings(
      golden,
      { located, units: pooledUnits[index] ?? [] },
      { lineTolerance: options.lineTolerance },
    ),
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
    file.findings.map((finding) => findingRange(file.path, finding)),
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

      const unit = findingRange(evaluation.path, evaluation.range);
      const hit = expected.some((finding) => containsRange(unit, finding));
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
): { f1: number; containmentF1: number } {
  const strict = emptyCounts();
  const containment = emptyCounts();

  for (const evaluations of runs) {
    const score = scoreLocatedFindings(
      golden,
      {
        located: findingsAtThreshold(evaluations, threshold),
        units: unitFindingsAtThreshold(evaluations, threshold),
      },
      { lineTolerance },
    );
    addCounts(strict, score.strict);
    addCounts(containment, score.containment);
  }

  return { f1: f1Of(strict), containmentF1: f1Of(containment) };
}

type MatchCounts = {
  expected: number;
  matchedExpected: number;
  findings: number;
  matchedFindings: number;
};

function emptyCounts(): MatchCounts {
  return { expected: 0, matchedExpected: 0, findings: 0, matchedFindings: 0 };
}

function addCounts(total: MatchCounts, part: MatchCounts): void {
  total.expected += part.expected;
  total.matchedExpected += part.matchedExpected;
  total.findings += part.findings;
  total.matchedFindings += part.matchedFindings;
}

function f1Of(score: MatchCounts): number {
  const precision =
    score.findings === 0 ? 1 : score.matchedFindings / score.findings;
  const recall =
    score.expected === 0 ? 1 : score.matchedExpected / score.expected;

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

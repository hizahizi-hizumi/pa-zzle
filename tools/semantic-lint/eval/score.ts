import type { Decision, SourceRange } from "../domain/model.ts";
import { dedupeNestedFindings } from "../units/dedupe.ts";
import type { GoldenSet } from "./golden.ts";

/** 評価方式に依存しない、採点対象の指摘範囲。 */
export type FindingRange = {
  path: string;
  startLine: number;
  endLine: number;
};

/** thresholdを変えて指摘を再構成するための判定記録。 */
export type ScoredEvaluation = {
  path: string;
  range: Pick<SourceRange, "startLine" | "endLine">;
  decision: Decision;
  violationProbability: number;
  /** 違反単位の中で特定した指摘範囲。ない場合はrangeを指摘範囲にする。 */
  locations?: Array<Pick<SourceRange, "startLine" | "endLine">>;
  /** 入れ子になりうる単位の判定。指摘の重複を最も内側だけに絞る。 */
  nested?: boolean;
};

export type Ratio = number | null;

export type FileScore = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: Ratio;
  recall: Ratio;
};

export type RangeScore = {
  expected: number;
  matchedExpected: number;
  findings: number;
  matchedFindings: number;
  precision: Ratio;
  recall: Ratio;
};

export type FileBreakdown = {
  path: string;
  expected: number;
  coveredExpected: number;
  findings: number;
  falseFindings: number;
};

export type RunScore = {
  files: FileScore;
  /** findingが期待行範囲を包含すれば一致とみなす。 */
  containment: RangeScore;
  /** 開始行と終了行がそれぞれ許容差以内なら1対1で一致とみなす。 */
  strict: RangeScore;
  findings: FindingRange[];
  missedExpected: FindingRange[];
  falseFindings: FindingRange[];
  byFile: FileBreakdown[];
};

export function scoreFindings(
  golden: GoldenSet,
  findings: readonly FindingRange[],
  options: { lineTolerance: number },
): RunScore {
  const { lineTolerance } = options;

  if (!Number.isInteger(lineTolerance) || lineTolerance < 0) {
    throw new Error("lineToleranceは0以上の整数で指定してください。");
  }

  const goldenPaths = new Set(golden.files.map((file) => file.path));
  const scoped = findings
    .filter((finding) => goldenPaths.has(finding.path))
    .map(({ path, startLine, endLine }) => ({ path, startLine, endLine }))
    .sort(compareRanges);
  const files: FileScore = {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
    precision: null,
    recall: null,
  };
  const containment = emptyRangeScore();
  const strict = emptyRangeScore();
  const missedExpected: FindingRange[] = [];
  const falseFindings: FindingRange[] = [];
  const byFile: FileBreakdown[] = [];

  for (const file of golden.files) {
    const expected = file.findings.map((finding) => ({
      path: file.path,
      startLine: finding.startLine,
      endLine: finding.endLine,
    }));
    const actual = scoped.filter((finding) => finding.path === file.path);
    const expectsFinding = expected.length > 0;
    const hasFinding = actual.length > 0;

    if (expectsFinding && hasFinding) {
      files.truePositives += 1;
    } else if (expectsFinding) {
      files.falseNegatives += 1;
    } else if (hasFinding) {
      files.falsePositives += 1;
    } else {
      files.trueNegatives += 1;
    }

    const covered = expected.filter((range) =>
      actual.some((finding) => contains(finding, range)),
    );
    const correct = actual.filter((finding) =>
      expected.some((range) => contains(finding, range)),
    );

    containment.expected += expected.length;
    containment.matchedExpected += covered.length;
    containment.findings += actual.length;
    containment.matchedFindings += correct.length;

    const strictMatches = matchStrictly(expected, actual, lineTolerance);
    strict.expected += expected.length;
    strict.matchedExpected += strictMatches;
    strict.findings += actual.length;
    strict.matchedFindings += strictMatches;

    const falseInFile = actual.filter((finding) => !correct.includes(finding));
    missedExpected.push(
      ...expected.filter((range) => !covered.includes(range)),
    );
    falseFindings.push(...falseInFile);
    byFile.push({
      path: file.path,
      expected: expected.length,
      coveredExpected: covered.length,
      findings: actual.length,
      falseFindings: falseInFile.length,
    });
  }

  files.precision = ratio(
    files.truePositives,
    files.truePositives + files.falsePositives,
  );
  files.recall = ratio(
    files.truePositives,
    files.truePositives + files.falseNegatives,
  );
  finishRangeScore(containment);
  finishRangeScore(strict);

  return {
    files,
    containment,
    strict,
    findings: scoped,
    missedExpected,
    falseFindings,
    byFile,
  };
}

/** 本番のdiagnostic生成と同じ条件でthreshold適用後の指摘を作る。 */
export function findingsAtThreshold(
  evaluations: readonly ScoredEvaluation[],
  threshold: number,
): FindingRange[] {
  const findings = evaluations
    .filter(
      (evaluation) =>
        evaluation.decision === "violation" &&
        evaluation.violationProbability >= threshold,
    )
    .sort(
      (left, right) => right.violationProbability - left.violationProbability,
    )
    .flatMap((evaluation) =>
      (evaluation.locations ?? [evaluation.range]).map((range) => ({
        path: evaluation.path,
        startLine: range.startLine,
        endLine: range.endLine,
      })),
    );

  return evaluations.some((evaluation) => evaluation.nested)
    ? dedupeNestedFindings(findings)
    : findings;
}

export type Summary = {
  runs: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
};

/** 繰り返し実行した値のばらつきを要約する。nullの値は集計から除く。 */
export function summarize(values: readonly Ratio[]): Summary {
  const present = values.filter((value): value is number => value !== null);

  if (present.length === 0) {
    return { runs: values.length, mean: null, min: null, max: null, stddev: null };
  }

  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  const variance =
    present.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    present.length;

  return {
    runs: values.length,
    mean,
    min: Math.min(...present),
    max: Math.max(...present),
    stddev: Math.sqrt(variance),
  };
}

export type FindingStability = {
  distinct: number;
  /** 全runで出た指摘の数。 */
  stable: number;
  /** 一部のrunだけで出た指摘。 */
  unstable: Array<FindingRange & { runs: number }>;
};

export function findingStability(
  runs: ReadonlyArray<readonly FindingRange[]>,
): FindingStability {
  const counts = new Map<string, { range: FindingRange; runs: number }>();

  for (const findings of runs) {
    const keys = new Set(findings.map(rangeKey));

    for (const key of keys) {
      const range = findings.find((finding) => rangeKey(finding) === key);

      if (!range) {
        continue;
      }

      const entry = counts.get(key) ?? { range, runs: 0 };
      entry.runs += 1;
      counts.set(key, entry);
    }
  }

  const entries = [...counts.values()].sort((left, right) =>
    compareRanges(left.range, right.range),
  );

  return {
    distinct: entries.length,
    stable: entries.filter((entry) => entry.runs === runs.length).length,
    unstable: entries
      .filter((entry) => entry.runs < runs.length)
      .map((entry) => ({ ...entry.range, runs: entry.runs })),
  };
}

function contains(outer: FindingRange, inner: FindingRange): boolean {
  return (
    outer.path === inner.path &&
    outer.startLine <= inner.startLine &&
    outer.endLine >= inner.endLine
  );
}

function matchStrictly(
  expected: readonly FindingRange[],
  actual: readonly FindingRange[],
  tolerance: number,
): number {
  const candidates: Array<{ expected: number; actual: number; cost: number }> =
    [];

  for (const [expectedIndex, range] of expected.entries()) {
    for (const [actualIndex, finding] of actual.entries()) {
      const startDelta = Math.abs(finding.startLine - range.startLine);
      const endDelta = Math.abs(finding.endLine - range.endLine);

      if (startDelta <= tolerance && endDelta <= tolerance) {
        candidates.push({
          expected: expectedIndex,
          actual: actualIndex,
          cost: startDelta + endDelta,
        });
      }
    }
  }

  candidates.sort(
    (left, right) =>
      left.cost - right.cost ||
      left.expected - right.expected ||
      left.actual - right.actual,
  );

  const usedExpected = new Set<number>();
  const usedActual = new Set<number>();

  for (const candidate of candidates) {
    if (usedExpected.has(candidate.expected) || usedActual.has(candidate.actual)) {
      continue;
    }

    usedExpected.add(candidate.expected);
    usedActual.add(candidate.actual);
  }

  return usedExpected.size;
}

function emptyRangeScore(): RangeScore {
  return {
    expected: 0,
    matchedExpected: 0,
    findings: 0,
    matchedFindings: 0,
    precision: null,
    recall: null,
  };
}

function finishRangeScore(score: RangeScore): void {
  score.precision = ratio(score.matchedFindings, score.findings);
  score.recall = ratio(score.matchedExpected, score.expected);
}

function ratio(numerator: number, denominator: number): Ratio {
  return denominator === 0 ? null : numerator / denominator;
}

function rangeKey(range: FindingRange): string {
  return `${range.path}:${range.startLine}-${range.endLine}`;
}

function compareRanges(left: FindingRange, right: FindingRange): number {
  return (
    left.path.localeCompare(right.path) ||
    left.startLine - right.startLine ||
    left.endLine - right.endLine
  );
}

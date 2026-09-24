import { ruleTargetLabel } from "../domain/model.ts";
import type { BenchmarkRuleResult, BenchmarkRun } from "./benchmark.ts";
import { type Calibration, calibrate } from "./calibrate.ts";
import type { GoldenFileStatus } from "./golden.ts";
import {
  type FindingRange,
  type FindingStability,
  findingStability,
  findingsAtThreshold,
  type Ratio,
  type RunScore,
  scoreFindings,
  type Summary,
  summarize,
} from "./score.ts";

export const DEFAULT_SWEEP_THRESHOLDS = [
  0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95,
] as const;

export type RunReport = {
  files: RunScore["files"];
  containment: RunScore["containment"];
  strict: RunScore["strict"];
  findings: number;
  providerRequests: number | null;
  judgeRequests: number | null;
  locateRequests: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
};

export type ThresholdSweepRow = {
  threshold: number;
  filePrecision: Summary;
  fileRecall: Summary;
  containmentPrecision: Summary;
  containmentRecall: Summary;
  strictPrecision: Summary;
  strictRecall: Summary;
  findings: Summary;
};

export type RuleBenchmarkReport = {
  ruleId: string;
  status: string;
  threshold: number;
  scope: string;
  baseCommit: string;
  golden: {
    files: number;
    filesWithFindings: number;
    filesWithoutFindings: number;
    expectedFindings: number;
    outdatedFiles: Array<{ path: string; status: GoldenFileStatus }>;
  };
  runs: RunReport[];
  summary: {
    filePrecision: Summary;
    fileRecall: Summary;
    containmentPrecision: Summary;
    containmentRecall: Summary;
    strictPrecision: Summary;
    strictRecall: Summary;
    findings: Summary;
    providerRequests: Summary;
    judgeRequests: Summary;
    locateRequests: Summary;
    inputTokens: Summary;
    outputTokens: Summary;
  };
  stability: FindingStability;
  byFile: Array<{
    path: string;
    expected: number;
    coveredExpected: Summary;
    findings: Summary;
    falseFindings: Summary;
  }>;
  missedExpected: Array<FindingRange & { runs: number }>;
  falseFindings: Array<FindingRange & { runs: number }>;
  thresholdSweep: ThresholdSweepRow[] | null;
  /** 判定記録からの閾値校正。判定記録を持たない実行結果ではnull。 */
  calibration: Calibration | null;
};

export type BenchmarkReport = {
  schemaVersion: 1;
  lineTolerance: number;
  /** 比較用に実行条件を記録する。 */
  variant?: Record<string, string>;
  rules: RuleBenchmarkReport[];
};

export function buildBenchmarkReport(
  results: BenchmarkRuleResult[],
  options: {
    lineTolerance: number;
    sweepThresholds?: readonly number[];
    variant?: Record<string, string>;
  },
): BenchmarkReport {
  const { lineTolerance, sweepThresholds = DEFAULT_SWEEP_THRESHOLDS } =
    options;

  return {
    schemaVersion: 1,
    lineTolerance,
    ...(options.variant === undefined ? {} : { variant: options.variant }),
    rules: results.map((result) =>
      buildRuleReport(result, lineTolerance, sweepThresholds),
    ),
  };
}

function buildRuleReport(
  result: BenchmarkRuleResult,
  lineTolerance: number,
  sweepThresholds: readonly number[],
): RuleBenchmarkReport {
  const { golden, rule, runs } = result;
  const scores = runs.map((run) =>
    scoreFindings(golden, run.findings, { lineTolerance }),
  );
  const runReports = runs.map((run, index): RunReport => {
    const score = scores[index];

    if (!score) {
      throw new Error("benchmark runの採点結果がありません。");
    }

    return {
      files: score.files,
      containment: score.containment,
      strict: score.strict,
      findings: score.findings.length,
      providerRequests: run.providerRequests,
      judgeRequests: run.judgeRequests ?? null,
      locateRequests: run.locateRequests ?? null,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      durationMs: run.durationMs,
    };
  });

  return {
    ruleId: rule.id,
    status: rule.status,
    threshold: rule.violationThreshold,
    scope: ruleTargetLabel(rule),
    baseCommit: golden.baseCommit,
    golden: {
      files: golden.files.length,
      filesWithFindings: golden.files.filter((file) => file.findings.length > 0)
        .length,
      filesWithoutFindings: golden.files.filter(
        (file) => file.findings.length === 0,
      ).length,
      expectedFindings: golden.files.reduce(
        (sum, file) => sum + file.findings.length,
        0,
      ),
      outdatedFiles: result.fileStatuses.filter(
        (file) => file.status !== "current",
      ),
    },
    runs: runReports,
    summary: {
      filePrecision: summarize(scores.map((score) => score.files.precision)),
      fileRecall: summarize(scores.map((score) => score.files.recall)),
      containmentPrecision: summarize(
        scores.map((score) => score.containment.precision),
      ),
      containmentRecall: summarize(
        scores.map((score) => score.containment.recall),
      ),
      strictPrecision: summarize(scores.map((score) => score.strict.precision)),
      strictRecall: summarize(scores.map((score) => score.strict.recall)),
      findings: summarize(scores.map((score) => score.findings.length)),
      providerRequests: summarize(runs.map((run) => run.providerRequests)),
      judgeRequests: summarize(runs.map((run) => run.judgeRequests ?? null)),
      locateRequests: summarize(runs.map((run) => run.locateRequests ?? null)),
      inputTokens: summarize(runs.map((run) => run.inputTokens)),
      outputTokens: summarize(runs.map((run) => run.outputTokens)),
    },
    stability: findingStability(scores.map((score) => score.findings)),
    byFile: golden.files.map((file) => {
      const rows = scores.map((score) =>
        score.byFile.find((row) => row.path === file.path),
      );

      return {
        path: file.path,
        expected: file.findings.length,
        coveredExpected: summarize(rows.map((row) => row?.coveredExpected ?? 0)),
        findings: summarize(rows.map((row) => row?.findings ?? 0)),
        falseFindings: summarize(rows.map((row) => row?.falseFindings ?? 0)),
      };
    }),
    missedExpected: countAcrossRuns(scores.map((score) => score.missedExpected)),
    falseFindings: countAcrossRuns(scores.map((score) => score.falseFindings)),
    thresholdSweep: buildThresholdSweep(
      golden,
      runs,
      lineTolerance,
      sweepThresholds,
    ),
    calibration: runs.some((run) => run.evaluations === null)
      ? null
      : calibrate(
          golden,
          runs.map((run) => run.evaluations ?? []),
          { lineTolerance },
        ),
  };
}

function buildThresholdSweep(
  golden: BenchmarkRuleResult["golden"],
  runs: BenchmarkRun[],
  lineTolerance: number,
  thresholds: readonly number[],
): ThresholdSweepRow[] | null {
  if (runs.some((run) => run.evaluations === null)) {
    return null;
  }

  return thresholds.map((threshold) => {
    const scores = runs.map((run) =>
      scoreFindings(
        golden,
        findingsAtThreshold(run.evaluations ?? [], threshold),
        { lineTolerance },
      ),
    );

    return {
      threshold,
      filePrecision: summarize(scores.map((score) => score.files.precision)),
      fileRecall: summarize(scores.map((score) => score.files.recall)),
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
  });
}

function countAcrossRuns(
  runs: ReadonlyArray<readonly FindingRange[]>,
): Array<FindingRange & { runs: number }> {
  const counts = new Map<string, FindingRange & { runs: number }>();

  for (const ranges of runs) {
    for (const range of ranges) {
      const key = `${range.path}:${range.startLine}-${range.endLine}`;
      const entry = counts.get(key) ?? { ...range, runs: 0 };
      entry.runs += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.startLine - right.startLine ||
      left.endLine - right.endLine,
  );
}

export function renderBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  if (report.variant !== undefined) {
    lines.push(
      `variant: ${Object.entries(report.variant)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ")}`,
      "",
    );
  }

  for (const rule of report.rules) {
    const runCount = rule.runs.length;
    lines.push(
      `${rule.ruleId} [${rule.status}, scope ${rule.scope}, threshold ${rule.threshold.toFixed(2)}]`,
      `  golden: ${rule.golden.files} files (指摘あり ${rule.golden.filesWithFindings} / 指摘なし ${rule.golden.filesWithoutFindings}), 期待finding ${rule.golden.expectedFindings}, base ${rule.baseCommit.slice(0, 12)}`,
    );

    for (const file of rule.golden.outdatedFiles) {
      lines.push(`  WARN goldenのblobとworking treeが異なります (${file.status}): ${file.path}`);
    }

    lines.push(
      `  runs: ${runCount}`,
      `  file         P ${formatSummary(rule.summary.filePrecision)}  R ${formatSummary(rule.summary.fileRecall)}`,
      `  包含         P ${formatSummary(rule.summary.containmentPrecision)}  R ${formatSummary(rule.summary.containmentRecall)}`,
      `  厳密(±${report.lineTolerance}行)  P ${formatSummary(rule.summary.strictPrecision)}  R ${formatSummary(rule.summary.strictRecall)}`,
      `  findings     ${formatSummary(rule.summary.findings, 1)}  (全run共通 ${rule.stability.stable} / distinct ${rule.stability.distinct})`,
      `  requests     ${formatSummary(rule.summary.providerRequests, 0)}${
        rule.summary.judgeRequests.mean === null
          ? ""
          : `  (判定 ${formatSummary(rule.summary.judgeRequests, 0)} / 位置特定 ${formatSummary(rule.summary.locateRequests, 0)})`
      }`,
      `  tokens       input ${formatSummary(rule.summary.inputTokens, 0)}  output ${formatSummary(rule.summary.outputTokens, 0)}`,
    );

    lines.push("  run別:");

    for (const [index, run] of rule.runs.entries()) {
      lines.push(
        `    #${index + 1} file P ${formatRatio(run.files.precision)} R ${formatRatio(run.files.recall)} | 包含 P ${formatRatio(run.containment.precision)} R ${formatRatio(run.containment.recall)} | 厳密 P ${formatRatio(run.strict.precision)} R ${formatRatio(run.strict.recall)} | findings ${run.findings} | requests ${formatCount(run.providerRequests)} | tokens ${formatCount(run.inputTokens)}/${formatCount(run.outputTokens)}`,
      );
    }

    lines.push("  file別 (期待 / 包含一致 mean / findings mean / 誤指摘 mean):");

    for (const file of rule.byFile) {
      lines.push(
        `    ${file.path}  ${file.expected} / ${formatMean(file.coveredExpected)} / ${formatMean(file.findings)} / ${formatMean(file.falseFindings)}`,
      );
    }

    if (rule.falseFindings.length > 0) {
      lines.push("  誤指摘 (出たrun数):");

      for (const finding of rule.falseFindings) {
        lines.push(
          `    ${finding.path}:${finding.startLine}-${finding.endLine} (${finding.runs}/${runCount})`,
        );
      }
    }

    if (rule.stability.unstable.length > 0) {
      lines.push("  runにより出たり出なかったりした指摘:");

      for (const finding of rule.stability.unstable) {
        lines.push(
          `    ${finding.path}:${finding.startLine}-${finding.endLine} (${finding.runs}/${runCount})`,
        );
      }
    }

    if (rule.thresholdSweep) {
      lines.push("  threshold sweep (mean):");

      for (const row of rule.thresholdSweep) {
        lines.push(
          `    ${row.threshold.toFixed(2)}  file P ${formatMean(row.filePrecision)} R ${formatMean(row.fileRecall)} | 包含 P ${formatMean(row.containmentPrecision)} R ${formatMean(row.containmentRecall)} | 厳密 P ${formatMean(row.strictPrecision)} R ${formatMean(row.strictRecall)} | findings ${formatMean(row.findings, 1)}`,
        );
      }
    }

    if (rule.calibration) {
      const calibration = rule.calibration;
      const cv = calibration.crossValidation;
      lines.push(
        `  校正 (包含F1最大): 推奨 ${calibration.threshold.toFixed(2)}  F1 ${calibration.f1.toFixed(3)}  gap ${formatSigned(calibration.gap)}  headroom ${formatSigned(calibration.headroom)}  候補 違反${calibration.positives}/クリーン${calibration.cleans}  包含recall上限 ${formatRatio(calibration.recallCeiling)}`,
        `  LOFO CV (${cv.folds} folds, 閾値 ${formatSummary(cv.thresholds, 2)}): 包含 P ${formatSummary(cv.containmentPrecision)} R ${formatSummary(cv.containmentRecall)} | 厳密 P ${formatSummary(cv.strictPrecision)} R ${formatSummary(cv.strictRecall)} | findings ${formatSummary(cv.findings, 1)}`,
      );
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function formatSummary(summary: Summary, digits = 3): string {
  if (summary.mean === null || summary.min === null || summary.max === null) {
    return "-";
  }

  return `${summary.mean.toFixed(digits)} [${summary.min.toFixed(digits)}–${summary.max.toFixed(digits)}]`;
}

function formatMean(summary: Summary, digits = 2): string {
  return summary.mean === null ? "-" : summary.mean.toFixed(digits);
}

function formatRatio(value: Ratio): string {
  return value === null ? "-" : value.toFixed(3);
}

function formatSigned(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return (value >= 0 ? "+" : "") + value.toFixed(2);
}

function formatCount(value: number | null): string {
  return value === null ? "-" : String(value);
}

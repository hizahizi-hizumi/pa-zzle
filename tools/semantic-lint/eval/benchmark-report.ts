import { DECISIONS, type Decision } from "../domain/model.ts";
import type {
  BenchmarkRequestRecord,
  BenchmarkRuleResult,
  BenchmarkRun,
} from "./benchmark.ts";
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
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedInputTokens: number | null;
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
  unit: string;
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
    inputTokens: Summary;
    outputTokens: Summary;
    estimatedInputTokens: Summary;
  };
  /** golden対象ファイルの行数の合計。1行1ruleあたりtokenの分母。 */
  lines: number | null;
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
  /** 判定分布 (run平均)。判定記録を持たない実行結果ではnull。 */
  decisions: Record<Decision, number> | null;
  /** 判定対象ごとの各runの判定と違反確率。誤りの原因調査に使う。 */
  subjects: SubjectDecisions[];
};

export type SubjectDecisions = FindingRange & {
  decisions: Array<Decision | null>;
  violationProbabilities: Array<number | null>;
};

/** request全体の見積もりと実usage。ruleへの按分をしない値。 */
export type UsageReport = {
  /** 対象fileの行数 × そのfileをgoldenに持つrule数の合計。 */
  lineRules: number;
  plannedRequests: number;
  estimatedInputTokens: number;
  runs: Array<{
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedInputTokens: number;
  }>;
  inputTokens: Summary;
  inputTokensPerLineRule: Summary;
  estimatedInputTokensPerLineRule: number | null;
  /** 実input token / 推定input token (全run合計)。 */
  actualToEstimate: number | null;
  /** runごとのrequest記録。 */
  requests: BenchmarkRequestRecord[][];
};

export type BenchmarkReport = {
  schemaVersion: 1;
  lineTolerance: number;
  rules: RuleBenchmarkReport[];
  usage: UsageReport | null;
};

export function buildBenchmarkReport(
  results: BenchmarkRuleResult[],
  options: {
    lineTolerance: number;
    sweepThresholds?: readonly number[];
    usage?: {
      lineRules: number;
      planned: readonly BenchmarkRequestRecord[];
      runRequests: BenchmarkRequestRecord[][];
    };
    /** ruleごとのgolden対象ファイルの行数。 */
    linesByRule?: ReadonlyMap<string, number>;
  },
): BenchmarkReport {
  const { lineTolerance, sweepThresholds = DEFAULT_SWEEP_THRESHOLDS } =
    options;

  return {
    schemaVersion: 1,
    lineTolerance,
    rules: results.map((result) =>
      buildRuleReport(
        result,
        lineTolerance,
        sweepThresholds,
        options.linesByRule?.get(result.golden.ruleId) ?? null,
      ),
    ),
    usage:
      options.usage === undefined ? null : buildUsageReport(options.usage),
  };
}

function buildUsageReport(usage: {
  lineRules: number;
  planned: readonly BenchmarkRequestRecord[];
  runRequests: BenchmarkRequestRecord[][];
}): UsageReport {
  const runs = usage.runRequests.map((records) => ({
    requests: records.length,
    inputTokens: sumOf(records, (record) => record.inputTokens ?? 0),
    outputTokens: sumOf(records, (record) => record.outputTokens ?? 0),
    estimatedInputTokens: sumOf(records, (record) => record.estimate.total),
  }));
  const estimatedInputTokens = sumOf(
    usage.planned,
    (record) => record.estimate.total,
  );
  const actual = sumOf(runs, (run) => run.inputTokens);
  const estimated = sumOf(runs, (run) => run.estimatedInputTokens);

  return {
    lineRules: usage.lineRules,
    plannedRequests: usage.planned.length,
    estimatedInputTokens,
    runs,
    inputTokens: summarize(runs.map((run) => run.inputTokens)),
    inputTokensPerLineRule: summarize(
      runs.map((run) =>
        usage.lineRules === 0 ? null : run.inputTokens / usage.lineRules,
      ),
    ),
    estimatedInputTokensPerLineRule:
      usage.lineRules === 0 ? null : estimatedInputTokens / usage.lineRules,
    actualToEstimate:
      runs.length === 0 || estimated === 0 ? null : actual / estimated,
    requests: usage.runRequests,
  };
}

function sumOf<T>(values: readonly T[], pick: (value: T) => number): number {
  return values.reduce((sum, value) => sum + pick(value), 0);
}

function buildRuleReport(
  result: BenchmarkRuleResult,
  lineTolerance: number,
  sweepThresholds: readonly number[],
  lines: number | null,
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
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      estimatedInputTokens: run.estimatedInputTokens ?? null,
      durationMs: run.durationMs,
    };
  });

  return {
    ruleId: rule.id,
    status: rule.status,
    threshold: rule.violationThreshold,
    unit: rule.unit,
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
      inputTokens: summarize(runs.map((run) => run.inputTokens)),
      outputTokens: summarize(runs.map((run) => run.outputTokens)),
      estimatedInputTokens: summarize(
        runs.map((run) => run.estimatedInputTokens ?? null),
      ),
    },
    lines,
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
    decisions: decisionDistribution(runs),
    subjects: subjectDecisions(runs),
  };
}

function subjectDecisions(runs: BenchmarkRun[]): SubjectDecisions[] {
  const bySubject = new Map<string, SubjectDecisions>();

  for (const [index, run] of runs.entries()) {
    for (const evaluation of run.evaluations ?? []) {
      const key = `${evaluation.path}:${evaluation.range.startLine}-${evaluation.range.endLine}`;
      const entry = bySubject.get(key) ?? {
        path: evaluation.path,
        startLine: evaluation.range.startLine,
        endLine: evaluation.range.endLine,
        decisions: runs.map(() => null),
        violationProbabilities: runs.map(() => null),
      };
      entry.decisions[index] = evaluation.decision;
      entry.violationProbabilities[index] = evaluation.violationProbability;
      bySubject.set(key, entry);
    }
  }

  return [...bySubject.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.startLine - right.startLine,
  );
}

function decisionDistribution(
  runs: BenchmarkRun[],
): Record<Decision, number> | null {
  if (runs.length === 0 || runs.some((run) => run.evaluations === null)) {
    return null;
  }

  return Object.fromEntries(
    DECISIONS.map((decision) => [
      decision,
      runs.reduce(
        (sum, run) =>
          sum +
          (run.evaluations ?? []).filter(
            (evaluation) => evaluation.decision === decision,
          ).length,
        0,
      ) / runs.length,
    ]),
  ) as Record<Decision, number>;
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

  for (const rule of report.rules) {
    const runCount = rule.runs.length;
    lines.push(
      `${rule.ruleId} [${rule.status}, unit ${rule.unit}, threshold ${rule.threshold.toFixed(2)}]`,
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
      `  requests     ${formatSummary(rule.summary.providerRequests, 0)}`,
      `  tokens       input ${formatSummary(rule.summary.inputTokens, 0)}  output ${formatSummary(rule.summary.outputTokens, 0)}  推定input ${formatSummary(rule.summary.estimatedInputTokens, 0)}${
        rule.lines === null || rule.summary.inputTokens.mean === null
          ? ""
          : `  (${(rule.summary.inputTokens.mean / rule.lines).toFixed(2)} / 行)`
      }`,
    );

    if (rule.decisions) {
      lines.push(
        `  判定分布     ${DECISIONS.map((decision) => `${decision} ${(rule.decisions?.[decision] ?? 0).toFixed(1)}`).join(" / ")}`,
      );
    }

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

  if (report.usage) {
    const usage = report.usage;
    lines.push(
      "usage (request全体。ruleへの按分なし)",
      `  requests     ${usage.plannedRequests}  line-rules ${usage.lineRules}`,
      `  input        実測 ${formatSummary(usage.inputTokens, 0)}  推定 ${usage.estimatedInputTokens}  実測/推定 ${formatRatio(usage.actualToEstimate)}`,
      `  per line×rule 実測 ${formatSummary(usage.inputTokensPerLineRule, 2)}  推定 ${usage.estimatedInputTokensPerLineRule === null ? "-" : usage.estimatedInputTokensPerLineRule.toFixed(2)}`,
    );
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Actionsのログで比較できるよう、ruleごとの主要指標とusageをJSON 1行ずつにする。 */
export function renderBenchmarkSummary(report: BenchmarkReport): string {
  const round = (value: number | null | undefined, digits = 3) =>
    value === null || value === undefined
      ? null
      : Math.round(value * 10 ** digits) / 10 ** digits;
  const at = (rule: RuleBenchmarkReport, threshold: number) => {
    const row = rule.thresholdSweep?.find(
      (candidate) => Math.abs(candidate.threshold - threshold) < 1e-9,
    );

    return row === undefined
      ? null
      : [
          round(row.containmentPrecision.mean),
          round(row.containmentRecall.mean),
          round(row.strictPrecision.mean),
          round(row.strictRecall.mean),
        ];
  };
  const lines = report.rules.map((rule) => {
    const calibration = rule.calibration;
    const cv = calibration?.crossValidation;

    return JSON.stringify({
      rule: rule.ruleId,
      unit: rule.unit,
      threshold: rule.threshold,
      runs: rule.runs.length,
      containment: [
        round(rule.summary.containmentPrecision.mean),
        round(rule.summary.containmentRecall.mean),
      ],
      strict: [
        round(rule.summary.strictPrecision.mean),
        round(rule.summary.strictRecall.mean),
      ],
      file: [
        round(rule.summary.filePrecision.mean),
        round(rule.summary.fileRecall.mean),
      ],
      recommended: calibration ? calibration.threshold : null,
      f1: round(calibration?.f1),
      gap: round(calibration?.gap, 2),
      headroom: round(calibration?.headroom, 2),
      candidates: calibration
        ? [calibration.positives, calibration.cleans]
        : null,
      recallCeiling: round(calibration?.recallCeiling),
      cv: cv
        ? {
            thresholds: [round(cv.thresholds.min, 2), round(cv.thresholds.max, 2)],
            containment: [
              round(cv.containmentPrecision.mean),
              round(cv.containmentRecall.mean),
            ],
            strict: [
              round(cv.strictPrecision.mean),
              round(cv.strictRecall.mean),
            ],
          }
        : null,
      sweep: Object.fromEntries(
        (rule.thresholdSweep ?? []).map((row) => [
          row.threshold.toFixed(2),
          at(rule, row.threshold),
        ]),
      ),
      findings: [rule.stability.stable, rule.stability.distinct],
      decisions: rule.decisions
        ? DECISIONS.map((decision) => round(rule.decisions?.[decision], 1))
        : null,
      requests: round(rule.summary.providerRequests.mean, 1),
      inputTokens: round(rule.summary.inputTokens.mean, 0),
      estimatedInputTokens: round(rule.summary.estimatedInputTokens.mean, 0),
      outputTokens: round(rule.summary.outputTokens.mean, 0),
      tokensPerLine:
        rule.lines === null || rule.summary.inputTokens.mean === null
          ? null
          : round(rule.summary.inputTokens.mean / rule.lines, 2),
      falseFindings: rule.falseFindings.map(
        (finding) =>
          `${finding.path}:${finding.startLine}-${finding.endLine}(${finding.runs})`,
      ),
      missed: rule.missedExpected.map(
        (finding) =>
          `${finding.path}:${finding.startLine}-${finding.endLine}(${finding.runs})`,
      ),
    });
  });

  const decisionCode: Record<Decision, string> = {
    violation: "V",
    compliant: "C",
    not_applicable: "N",
    insufficient_context: "I",
  };

  for (const rule of report.rules) {
    for (const subject of rule.subjects) {
      lines.push(
        JSON.stringify({
          subject: rule.ruleId,
          at: `${subject.path}:${subject.startLine}-${subject.endLine}`,
          d: subject.decisions
            .map((decision) => (decision === null ? "-" : decisionCode[decision]))
            .join(""),
          p: subject.violationProbabilities.map((value) => round(value, 2)),
        }),
      );
    }
  }

  if (report.usage) {
    const usage = report.usage;
    lines.push(
      JSON.stringify({
        usage: {
          lineRules: usage.lineRules,
          plannedRequests: usage.plannedRequests,
          estimated: usage.estimatedInputTokens,
          actual: usage.runs.map((run) => run.inputTokens),
          output: usage.runs.map((run) => run.outputTokens),
          actualToEstimate: round(usage.actualToEstimate),
          perLineRule: round(usage.inputTokensPerLineRule.mean, 2),
          estimatedPerLineRule: round(usage.estimatedInputTokensPerLineRule, 2),
        },
      }),
    );

    // 推定係数の検証用に、requestごとの内訳と実usageを1行ずつ出す。
    for (const [run, records] of usage.requests.entries()) {
      for (const record of records) {
        lines.push(
          JSON.stringify({
            request: run,
            path: record.path,
            q: record.questions,
            qEst: record.questionEstimates,
            chars: record.stateChars,
            nonAscii: record.stateNonAsciiChars,
            est: record.estimate,
            in: record.inputTokens,
            out: record.outputTokens,
          }),
        );
      }
    }
  }

  return lines.join("\n") + "\n";
}

function formatSigned(value: number | null): string {
  return value === null ? "-" : (value >= 0 ? "+" : "") + value.toFixed(2);
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

function formatCount(value: number | null): string {
  return value === null ? "-" : String(value);
}

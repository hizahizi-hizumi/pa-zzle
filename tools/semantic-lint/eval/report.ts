import type { Decision, SourceRange } from "../domain/model.ts";
import type { GoldenCaseResult } from "./run.ts";

export function renderGoldenCaseReport(
  results: GoldenCaseResult[],
): string {
  const lines: string[] = [];
  let exactMatches = 0;
  let thresholdMatches = 0;
  let findingMatches = 0;
  let findingComparedRuns = 0;
  let totalRuns = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const result of results) {
    lines.push(`${result.rule.title} [${result.rule.id}]`);
    const probabilities = result.runs.map(
      (run) => run.result.probabilities.violation,
    );
    const exact = result.runs.filter(
      (run) => run.result.decision === result.case.expected,
    ).length;
    const threshold = result.runs.filter((run) =>
      thresholdMatchesExpected(
        result.case.expected,
        run.result.probabilities.violation,
        result.rule.violationThreshold,
      ),
    ).length;
    const findingComparisons = result.runs.flatMap((run) =>
      run.findingComparison === undefined ? [] : [run.findingComparison],
    );
    const exactFindingRuns = findingComparisons.filter(
      (comparison) => comparison.exact,
    ).length;

    exactMatches += exact;
    thresholdMatches += threshold;
    findingMatches += exactFindingRuns;
    findingComparedRuns += findingComparisons.length;
    totalRuns += result.runs.length;
    inputTokens += result.runs.reduce(
      (sum, run) => sum + run.inputTokens,
      0,
    );
    outputTokens += result.runs.reduce(
      (sum, run) => sum + run.outputTokens,
      0,
    );

    lines.push(
      `  ${result.case.name}`,
      `    期待値: ${decisionLabel(result.case.expected)}`,
      `    Choice一致: ${exact}/${result.runs.length} (${percentage(
        exact / result.runs.length,
      )})`,
      `    違反確率: min ${percentage(Math.min(...probabilities))} / mean ${percentage(
        mean(probabilities),
      )} / max ${percentage(Math.max(...probabilities))}`,
      `    閾値判定一致: ${threshold}/${result.runs.length} (閾値 ${percentage(
        result.rule.violationThreshold,
      )})`,
    );

    if (findingComparisons.length > 0) {
      lines.push(
        `    指摘位置一致: ${exactFindingRuns}/${findingComparisons.length} (${percentage(
          exactFindingRuns / findingComparisons.length,
        )})`,
      );

      const firstMismatch = findingComparisons.find(
        (comparison) => !comparison.exact,
      );

      if (firstMismatch) {
        lines.push(
          `    期待位置: ${formatRanges(firstMismatch.expectedRanges)}`,
          `    実際位置: ${formatRanges(firstMismatch.actualRanges)}`,
        );
      }
    }

    lines.push("");
  }

  lines.push(
    "集計",
    `  ケース: ${results.length}`,
    `  実行回数: ${totalRuns}`,
    `  Choice一致: ${exactMatches}/${totalRuns} (${percentage(
      totalRuns === 0 ? 0 : exactMatches / totalRuns,
    )})`,
    `  閾値判定一致: ${thresholdMatches}/${totalRuns} (${percentage(
      totalRuns === 0 ? 0 : thresholdMatches / totalRuns,
    )})`,
  );

  if (findingComparedRuns > 0) {
    lines.push(
      `  指摘位置一致: ${findingMatches}/${findingComparedRuns} (${percentage(
        findingMatches / findingComparedRuns,
      )})`,
    );
  }

  lines.push(
    `  入力トークン: ${inputTokens}`,
    `  出力トークン: ${outputTokens}`,
  );

  return lines.join("\n").trimEnd() + "\n";
}

function thresholdMatchesExpected(
  expected: Decision,
  violationProbability: number,
  threshold: number,
): boolean {
  if (expected === "violation") {
    return violationProbability >= threshold;
  }

  return violationProbability < threshold;
}

function decisionLabel(decision: Decision): string {
  switch (decision) {
    case "violation":
      return "違反";
    case "compliant":
      return "問題なし";
    case "not_applicable":
      return "対象外";
    case "insufficient_context":
      return "文脈不足";
  }
}

function formatRanges(ranges: SourceRange[]): string {
  if (ranges.length === 0) {
    return "なし";
  }

  return ranges.map(formatRange).join(", ");
}

function formatRange(range: SourceRange): string {
  return (
    `${range.startLine}:${range.startColumn}-` +
    `${range.endLine}:${range.endColumn}`
  );
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

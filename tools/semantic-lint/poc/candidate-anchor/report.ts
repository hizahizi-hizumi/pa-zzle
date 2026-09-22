import type { CandidateAnchorBenchmarkResult } from "./run.ts";

export function renderCandidateAnchorBenchmark(
  result: CandidateAnchorBenchmarkResult,
): string {
  const lines: string[] = ["Candidate + Anchor PoC", ""];

  for (const item of result.cases) {
    lines.push(
      `${item.exact ? "PASS" : "FAIL"} ${item.name} [${item.ruleId}]`,
      `  candidates=${item.candidateCount} anchors=${item.anchorCount} classification=${item.classificationDecisions} localization=${item.localizationDecisions}`,
      `  findings expected=${item.expectedFindings} actual=${item.actualFindings} matched=${item.matchedFindings}`,
      `  requests=${item.providerRequests} inputTokens=${item.inputTokens} outputTokens=${item.outputTokens}`,
    );

    if (!item.exact) {
      lines.push(
        `  actualRanges=${item.findings.map((finding) => formatRange(finding.range)).join(", ") || "none"}`,
      );
    }

    lines.push("");
  }

  const metrics = result.metrics;
  const precision =
    metrics.actualFindings === 0
      ? metrics.expectedFindings === 0
        ? 1
        : 0
      : metrics.matchedFindings / metrics.actualFindings;
  const recall =
    metrics.expectedFindings === 0
      ? 1
      : metrics.matchedFindings / metrics.expectedFindings;

  lines.push(
    "summary",
    `  exactCases=${metrics.exactCases}/${result.cases.length}`,
    `  findingPrecision=${percentage(precision)}`,
    `  findingRecall=${percentage(recall)}`,
    `  candidates=${metrics.candidateCount} anchors=${metrics.anchorCount}`,
    `  classificationDecisions=${metrics.classificationDecisions} localizationDecisions=${metrics.localizationDecisions}`,
    `  providerRequests=${metrics.providerRequests}`,
    `  inputTokens=${metrics.inputTokens} outputTokens=${metrics.outputTokens}`,
  );

  return lines.join("\n") + "\n";
}

function formatRange(range: {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}): string {
  return `${range.startLine}:${range.startColumn}-${range.endLine}:${range.endColumn}`;
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

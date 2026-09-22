import type { SourceRange } from "../../domain/model.ts";
import type { RegionAnchorBenchmarkResult } from "./run.ts";

export function renderRegionAnchorBenchmark(
  result: RegionAnchorBenchmarkResult,
): string {
  const lines = ["Region + Anchor PoC", ""];

  for (const item of result.cases) {
    lines.push(
      `${item.exact ? "PASS" : "FAIL"} ${item.name} [${item.ruleId}]`,
      `  positiveRegions=${item.positiveRegions.length} maxProbability=${percentage(item.maxRegionViolationProbability)} gateCorrect=${item.regionGateCorrect}`,
      `  regionCoverage=${item.regionCoveredFindings}/${item.expectedFindings}`,
      `  groups=${item.locationGroups} anchors=${item.anchors} regionDecisions=${item.regionDecisions} localization=${item.localizationDecisions}`,
      `  findings expected=${item.expectedFindings} actual=${item.actualFindings} matched=${item.matchedFindings}`,
      `  requests=${item.providerRequests} inputTokens=${item.inputTokens} outputTokens=${item.outputTokens}`,
    );

    if (!item.exact) {
      lines.push(
        `  positiveRegionKinds=${item.positiveRegions.join(", ") || "none"}`,
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
  const regionCoverage =
    metrics.expectedFindings === 0
      ? 1
      : metrics.regionCoveredFindings / metrics.expectedFindings;

  lines.push(
    "summary",
    `  exactCases=${metrics.exactCases}/${result.cases.length}`,
    `  regionGateAccuracy=${percentage(metrics.correctRegionGates / result.cases.length)}`,
    `  regionCoverage=${percentage(regionCoverage)}`,
    `  findingPrecision=${percentage(precision)}`,
    `  findingRecall=${percentage(recall)}`,
    `  regionDecisions=${metrics.regionDecisions} localizationDecisions=${metrics.localizationDecisions}`,
    `  providerRequests=${metrics.providerRequests}`,
    `  inputTokens=${metrics.inputTokens} outputTokens=${metrics.outputTokens}`,
  );

  return lines.join("\n") + "\n";
}

function formatRange(range: SourceRange): string {
  return `${range.startLine}:${range.startColumn}-${range.endLine}:${range.endColumn}`;
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

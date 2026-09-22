import type { SourceRange } from "../../domain/model.ts";
import type { SelectorFirstBenchmarkResult } from "./run.ts";

export function renderSelectorFirstBenchmark(
  result: SelectorFirstBenchmarkResult,
): string {
  const lines: string[] = ["Selector-first PoC", "", "selectors"];

  for (const selector of result.selectors) {
    lines.push(
      `  ${selector.ruleId}: ${selector.selected.join(", ") || "none"}`,
      `    decisions=${selector.decisions} requests=${selector.usage.providerRequests} inputTokens=${selector.usage.inputTokens} outputTokens=${selector.usage.outputTokens}`,
    );
  }

  lines.push("");

  for (const item of result.cases) {
    lines.push(
      `${item.exact ? "PASS" : "FAIL"} ${item.name} [${item.ruleId}]`,
      `  selectors=${item.selectedSelectors.join(",") || "none"}`,
      `  selectorCoverage=${item.selectorCoveredFindings}/${item.expectedFindings}`,
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
  const selectorCoverage =
    metrics.expectedFindings === 0
      ? 1
      : metrics.selectorCoveredFindings / metrics.expectedFindings;

  lines.push(
    "summary",
    `  exactCases=${metrics.exactCases}/${result.cases.length}`,
    `  selectorCoverage=${percentage(selectorCoverage)}`,
    `  findingPrecision=${percentage(precision)}`,
    `  findingRecall=${percentage(recall)}`,
    `  selectorDecisions=${metrics.selectorDecisions}`,
    `  candidates=${metrics.candidateCount} anchors=${metrics.anchorCount}`,
    `  classificationDecisions=${metrics.classificationDecisions} localizationDecisions=${metrics.localizationDecisions}`,
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

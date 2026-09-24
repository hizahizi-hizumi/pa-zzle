import type {
  CacheMetrics,
  Diagnostic,
  RunResult,
} from "../domain/model.ts";

export type OutputFormat = "pretty" | "compact" | "json";

export function renderRunResult(
  result: RunResult,
  format: OutputFormat,
): string {
  switch (format) {
    case "pretty":
      return renderPretty(result);
    case "compact":
      return renderCompact(result);
    case "json":
      return JSON.stringify(result, null, 2) + "\n";
  }
}

export function renderPretty(result: RunResult): string {
  const lines: string[] = [];
  const byPath = groupDiagnosticsByPath(result.diagnostics);

  for (const [path, diagnostics] of byPath) {
    lines.push(path, "");

    for (const diagnostic of diagnostics) {
      const range = formatPrettyRange(diagnostic);
      lines.push(
        `  ${range.padEnd(16)} ${diagnostic.severity.padEnd(7)} ${diagnostic.message}`,
        `  ${"".padEnd(16)} ${diagnostic.ruleId}  violation=${percentage(
          diagnostic.probability,
        )}${
          diagnostic.partProbability === undefined
            ? ""
            : ` location=${percentage(diagnostic.partProbability)}`
        } confidence=${percentage(diagnostic.confidence)}`,
      );

      if (diagnostic.symbol) {
        const subject = diagnostic.subjectRange;
        const located =
          subject.startLine !== diagnostic.range.startLine ||
          subject.endLine !== diagnostic.range.endLine;
        lines.push(
          `  ${"".padEnd(16)} symbol=${diagnostic.symbol}${
            located ? ` (${subject.startLine}-${subject.endLine}行)` : ""
          }`,
        );
      }

      lines.push("");
    }
  }

  const warningCount = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const errorCount = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  lines.push(
    summaryLabel(warningCount, "warning"),
    summaryLabel(errorCount, "error"),
    `${result.unknowns.length} unknown`,
    "",
    `${result.metrics.scannedFiles} files, ${result.metrics.subjects} subjects, ${result.metrics.plannedEvaluations} evaluations`,
    `${result.metrics.providerRequests} provider requests, ${result.metrics.providerDecisions} decisions, ${result.metrics.inputTokens} input tokens, ${duration(result.metrics.totalDurationMs)}`,
    cacheSummary(result.metrics.cache),
  );

  return lines.join("\n").trimEnd() + "\n";
}

export function renderCompact(result: RunResult): string {
  const lines = result.diagnostics.map((diagnostic) => {
    const range = diagnostic.range;
    return (
      `${diagnostic.path}:${range.startLine}:${range.startColumn}-` +
      `${range.endLine}:${range.endColumn} ` +
      `${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`
    );
  });

  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

function groupDiagnosticsByPath(
  diagnostics: Diagnostic[],
): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();

  for (const diagnostic of diagnostics) {
    const values = grouped.get(diagnostic.path) ?? [];
    values.push(diagnostic);
    grouped.set(diagnostic.path, values);
  }

  return grouped;
}

function formatPrettyRange(diagnostic: Diagnostic): string {
  const range = diagnostic.range;
  return (
    `${range.startLine}:${range.startColumn}-` +
    `${range.endLine}:${range.endColumn}`
  );
}

function cacheSummary(cache: CacheMetrics): string {
  if (!cache.enabled) {
    return "cache disabled";
  }

  return `cache ${cache.hits} hits, ${cache.misses} misses`;
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function duration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${Math.round(milliseconds)}ms`;
  }

  return `${(milliseconds / 1_000).toFixed(2)}s`;
}

function summaryLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

import type {
  Finding,
  RunResult,
  SourceDocument,
  SourceRange,
} from "../domain/model.ts";

export type OutputFormat = "pretty" | "compact" | "json";

type PrettyFrame = {
  path: string;
  ruleId: string;
  severity: Finding["severity"];
  message: string;
  startLine: number;
  endLine: number;
  findings: Finding[];
};

export function renderRunResult(
  result: RunResult,
  format: OutputFormat,
  options: { documents?: SourceDocument[] } = {},
): string {
  switch (format) {
    case "pretty":
      return renderPretty(result, options.documents ?? []);
    case "compact":
      return renderCompact(result);
    case "json":
      return JSON.stringify(result, null, 2) + "\n";
  }
}

export function renderPretty(
  result: RunResult,
  documents: SourceDocument[] = [],
): string {
  const lines: string[] = [];
  const sourcesByPath = new Map(
    documents.map((document) => [document.path, document.source]),
  );
  const frames = buildPrettyFrames(result.diagnostics, sourcesByPath);

  for (const frame of frames) {
    const first = frame.findings[0];

    if (!first) {
      continue;
    }

    lines.push(
      `${frame.path}:${first.range.startLine}:${first.range.startColumn} ${frame.ruleId} ━━━━━━━━━━━━━━━`,
      "",
      `  ${severityMark(frame.severity)} ${frame.message}${findingCountLabel(frame.findings.length)}`,
      "",
    );

    const source = sourcesByPath.get(frame.path);

    if (source === undefined) {
      for (const finding of frame.findings) {
        lines.push(`  ${formatRange(finding.range)}`);
      }
    } else {
      lines.push(...renderCodeFrame(source, frame));
    }

    lines.push("");
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

function buildPrettyFrames(
  findings: Finding[],
  sourcesByPath: Map<string, string>,
): PrettyFrame[] {
  const grouped = groupByPathAndRule(findings);
  const frames: PrettyFrame[] = [];

  for (const values of grouped.values()) {
    const sorted = [...values].sort(compareFindings);
    const source = sorted[0]
      ? sourcesByPath.get(sorted[0].path)
      : undefined;
    const lineCount = source === undefined
      ? Number.MAX_SAFE_INTEGER
      : splitSourceLines(source).length;
    let current: PrettyFrame | undefined;

    for (const finding of sorted) {
      const window = displayWindow(finding.range, lineCount);

      if (!current || window.startLine > current.endLine) {
        current = {
          path: finding.path,
          ruleId: finding.ruleId,
          severity: finding.severity,
          message: finding.message,
          startLine: window.startLine,
          endLine: window.endLine,
          findings: [finding],
        };
        frames.push(current);
        continue;
      }

      current.endLine = Math.max(current.endLine, window.endLine);
      current.findings.push(finding);
    }
  }

  return frames.sort(compareFrames);
}

function groupByPathAndRule(
  findings: Finding[],
): Map<string, Finding[]> {
  const grouped = new Map<string, Finding[]>();

  for (const finding of findings) {
    const key = `${finding.path}\0${finding.ruleId}`;
    const values = grouped.get(key) ?? [];
    values.push(finding);
    grouped.set(key, values);
  }

  return grouped;
}

function displayWindow(
  range: SourceRange,
  lineCount: number,
): { startLine: number; endLine: number } {
  return {
    startLine: Math.max(1, range.startLine - 1),
    endLine: Math.min(lineCount, Math.max(range.startLine, range.endLine) + 1),
  };
}

function renderCodeFrame(source: string, frame: PrettyFrame): string[] {
  const sourceLines = splitSourceLines(source);
  const width = String(frame.endLine).length;
  const lines: string[] = [];

  for (let lineNumber = frame.startLine; lineNumber <= frame.endLine; lineNumber += 1) {
    const sourceLine = sourceLines[lineNumber - 1] ?? "";
    const marker = markerForLine(sourceLine, lineNumber, frame.findings);
    const prefix = marker === null ? " " : ">";

    lines.push(
      `  ${prefix} ${String(lineNumber).padStart(width)} │ ${sourceLine}`,
    );

    if (marker !== null) {
      lines.push(`    ${" ".repeat(width)} │ ${marker}`);
    }
  }

  return lines;
}

function markerForLine(
  sourceLine: string,
  lineNumber: number,
  findings: Finding[],
): string | null {
  const markers: string[] = sourceLine
    .split("")
    .map((character) => (character === "\t" ? "\t" : " "));
  let marked = false;

  for (const finding of findings) {
    const segment = segmentForLine(finding.range, lineNumber, sourceLine.length);

    if (!segment) {
      continue;
    }

    marked = true;
    const start = Math.max(0, segment.start);
    const end = Math.max(start + 1, Math.min(sourceLine.length, segment.end));

    for (let index = start; index < end; index += 1) {
      markers[index] = "^";
    }
  }

  if (!marked) {
    return null;
  }

  const marker = markers.join("").trimEnd();
  return marker.length === 0 ? "^" : marker;
}

function segmentForLine(
  range: SourceRange,
  lineNumber: number,
  lineLength: number,
): { start: number; end: number } | null {
  if (lineNumber < range.startLine || lineNumber > range.endLine) {
    return null;
  }

  const start = lineNumber === range.startLine
    ? range.startColumn - 1
    : 0;
  const end = lineNumber === range.endLine
    ? range.endColumn - 1
    : lineLength;

  if (end <= start) {
    return null;
  }

  return { start, end };
}

function splitSourceLines(source: string): string[] {
  return source.replaceAll("\r\n", "\n").split("\n");
}

function compareFindings(left: Finding, right: Finding): number {
  return (
    left.range.startLine - right.range.startLine ||
    left.range.startColumn - right.range.startColumn ||
    left.range.endLine - right.range.endLine ||
    left.range.endColumn - right.range.endColumn
  );
}

function compareFrames(left: PrettyFrame, right: PrettyFrame): number {
  return (
    left.path.localeCompare(right.path) ||
    left.startLine - right.startLine ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function severityMark(severity: Finding["severity"]): string {
  return severity === "error" ? "×" : "⚠";
}

function findingCountLabel(count: number): string {
  return count > 1 ? ` (${count} findings)` : "";
}

function formatRange(range: SourceRange): string {
  return (
    `${range.startLine}:${range.startColumn}-` +
    `${range.endLine}:${range.endColumn}`
  );
}

function summaryLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

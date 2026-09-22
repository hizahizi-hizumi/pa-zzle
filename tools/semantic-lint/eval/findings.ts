import type { GoldenFindingExpectation } from "../config/cases.ts";
import type { Finding, SourceRange } from "../domain/model.ts";

export type FindingComparison = {
  expectedRanges: SourceRange[];
  actualRanges: SourceRange[];
  matched: number;
  exact: boolean;
};

export function resolveExpectedFindingRanges(
  source: string,
  expectations: GoldenFindingExpectation[],
): SourceRange[] {
  return expectations.map((expectation) => {
    if ("range" in expectation) {
      return expectation.range;
    }

    const start = nthOccurrence(
      source,
      expectation.text,
      expectation.occurrence,
    );

    if (start < 0) {
      throw new Error(
        `expected finding textがfixtureにありません: ${JSON.stringify(expectation.text)} occurrence=${expectation.occurrence}`,
      );
    }

    return rangeFromOffsets(source, start, start + expectation.text.length);
  });
}

export function compareFindingRanges(
  expectedRanges: SourceRange[],
  findings: Finding[],
): FindingComparison {
  const actualRanges = findings.map((finding) => finding.range);
  const expectedCounts = rangeCounts(expectedRanges);
  const actualCounts = rangeCounts(actualRanges);
  let matched = 0;

  for (const [key, expectedCount] of expectedCounts) {
    matched += Math.min(expectedCount, actualCounts.get(key) ?? 0);
  }

  return {
    expectedRanges,
    actualRanges,
    matched,
    exact:
      matched === expectedRanges.length &&
      matched === actualRanges.length,
  };
}

function nthOccurrence(source: string, text: string, occurrence: number): number {
  let fromIndex = 0;

  for (let index = 1; index <= occurrence; index += 1) {
    const found = source.indexOf(text, fromIndex);

    if (found < 0) {
      return -1;
    }

    if (index === occurrence) {
      return found;
    }

    fromIndex = found + text.length;
  }

  return -1;
}

function rangeFromOffsets(
  source: string,
  start: number,
  end: number,
): SourceRange {
  const startPosition = positionAt(source, start);
  const endPosition = positionAt(source, end);

  return {
    startLine: startPosition.line,
    startColumn: startPosition.column,
    endLine: endPosition.line,
    endColumn: endPosition.column,
  };
}

function positionAt(
  source: string,
  offset: number,
): { line: number; column: number } {
  const before = source.slice(0, offset);
  const lastNewline = before.lastIndexOf("\n");
  const line = before.split("\n").length;

  return {
    line,
    column: offset - lastNewline,
  };
}

function rangeCounts(ranges: SourceRange[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const range of ranges) {
    const key = rangeKey(range);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function rangeKey(range: SourceRange): string {
  return [
    range.startLine,
    range.startColumn,
    range.endLine,
    range.endColumn,
  ].join(":");
}

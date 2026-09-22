import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  SourceDocument,
  SourceRange,
} from "../../domain/model.ts";
import type { LocationGroup } from "./extract.ts";

export type SemanticRegion = {
  id: string;
  kind: "file" | "vitest-describe" | "vitest-test" | "vitest-before-each";
  label: string;
  range: SourceRange;
  source: string;
  groups: LocationGroup[];
};

type RegionNode = {
  kind: Exclude<SemanticRegion["kind"], "file">;
  label: string;
  start: number;
  end: number;
};

export function extractSemanticRegions(
  document: SourceDocument,
  groups: LocationGroup[],
): SemanticRegion[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const regionNodes: RegionNode[] = [];

  function visit(node: ts.Node): void {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const name = calleeRootName(node.expression.expression);
      const kind = regionKind(name);

      if (kind !== null) {
        regionNodes.push({
          kind,
          label: name ?? kind,
          start: node.getStart(sourceFile),
          end: node.getEnd(),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const regions: SemanticRegion[] = [
    {
      id: "region:file",
      kind: "file",
      label: "file",
      range: fullFileRange(document.source),
      source: document.source,
      groups: [],
    },
    ...regionNodes.map((node, index) => ({
      id: `region:${index}:${node.kind}`,
      kind: node.kind,
      label: node.label,
      range: rangeOf(sourceFile, node.start, node.end),
      source: document.source.slice(node.start, node.end),
      groups: [],
    })),
  ];

  for (const group of groups) {
    const region = smallestContainingRegion(regions, group.range);
    region.groups.push(group);
  }

  return regions.filter(
    (region) => region.kind === "file" || region.groups.length > 0,
  );
}

function smallestContainingRegion(
  regions: SemanticRegion[],
  range: SourceRange,
): SemanticRegion {
  let selected = regions[0];

  if (!selected) {
    throw new Error("file regionがありません。");
  }

  for (const region of regions.slice(1)) {
    if (!containsRange(region.range, range)) {
      continue;
    }

    if (
      selected.kind === "file" ||
      containsRange(selected.range, region.range)
    ) {
      selected = region;
    }
  }

  return selected;
}

function containsRange(outer: SourceRange, inner: SourceRange): boolean {
  return (
    comparePosition(
      outer.startLine,
      outer.startColumn,
      inner.startLine,
      inner.startColumn,
    ) <= 0 &&
    comparePosition(
      outer.endLine,
      outer.endColumn,
      inner.endLine,
      inner.endColumn,
    ) >= 0
  );
}

function comparePosition(
  leftLine: number,
  leftColumn: number,
  rightLine: number,
  rightColumn: number,
): number {
  return leftLine - rightLine || leftColumn - rightColumn;
}

function regionKind(
  name: string | null,
): Exclude<SemanticRegion["kind"], "file"> | null {
  if (name === "describe") return "vitest-describe";
  if (name === "test" || name === "it") return "vitest-test";
  if (name === "beforeEach") return "vitest-before-each";
  return null;
}

function calleeRootName(expression: ts.Expression): string | null {
  let current: ts.Expression = expression;

  while (true) {
    if (ts.isIdentifier(current)) return current.text;
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
}

function rangeOf(
  sourceFile: ts.SourceFile,
  start: number,
  end: number,
): SourceRange {
  const startPosition = sourceFile.getLineAndCharacterOfPosition(start);
  const endPosition = sourceFile.getLineAndCharacterOfPosition(end);

  return {
    startLine: startPosition.line + 1,
    startColumn: startPosition.character + 1,
    endLine: endPosition.line + 1,
    endColumn: endPosition.character + 1,
  };
}

function fullFileRange(source: string): SourceRange {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const endLine = Math.max(1, lines.length);

  return {
    startLine: 1,
    startColumn: 1,
    endLine,
    endColumn: (lines[endLine - 1] ?? "").length + 1,
  };
}

function scriptKind(path: string): ts.ScriptKind {
  switch (extname(path)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

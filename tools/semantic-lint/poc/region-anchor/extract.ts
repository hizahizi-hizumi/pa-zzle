import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type { SourceDocument, SourceRange } from "../../domain/model.ts";

export type RegionAnchor = {
  id: string;
  role: string;
  range: SourceRange;
  source: string;
};

export type LocationGroup = {
  id: string;
  kind: string;
  label: string;
  range: SourceRange;
  source: string;
  anchors: RegionAnchor[];
};

export function extractLocationGroups(document: SourceDocument): LocationGroup[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const nodes: Array<{ node: ts.Node; kind: string }> = [];

  function visit(node: ts.Node): void {
    const kind = groupKind(node);

    if (kind !== null) {
      nodes.push({ node, kind });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  nodes.sort(
    (left, right) =>
      left.node.getStart(sourceFile) - right.node.getStart(sourceFile) ||
      left.node.getEnd() - right.node.getEnd(),
  );

  return nodes.map(({ node, kind }, index) =>
    locationGroupFromNode(sourceFile, document.source, node, kind, index),
  );
}

function groupKind(node: ts.Node): string | null {
  if (ts.isVariableDeclaration(node)) return "variable-declaration";
  if (ts.isExpressionStatement(node)) return "expression-statement";
  if (ts.isReturnStatement(node)) return "return-statement";
  if (ts.isThrowStatement(node)) return "throw-statement";
  if (ts.isFunctionDeclaration(node)) return "function-declaration";
  if (ts.isMethodDeclaration(node)) return "method-declaration";
  if (ts.isClassDeclaration(node)) return "class-declaration";
  if (ts.isPropertyDeclaration(node)) return "property-declaration";
  return null;
}

function locationGroupFromNode(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  kind: string,
  index: number,
): LocationGroup {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();

  return {
    id: `group:${index}`,
    kind,
    label: groupLabel(node, kind),
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    anchors: anchorsForNode(sourceFile, source, node, index),
  };
}

function anchorsForNode(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  groupIndex: number,
): RegionAnchor[] {
  const anchors: Array<{ role: string; node: ts.Node }> = [
    { role: "self", node },
  ];

  if (ts.isVariableDeclaration(node)) {
    const statement = variableStatementOf(node);

    if (statement !== null) {
      anchors.push({ role: "statement", node: statement });
    }

    anchors.push({ role: "name", node: node.name });

    if (node.initializer) {
      anchors.push({ role: "initializer", node: node.initializer });
    }
  } else if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isPropertyDeclaration(node)
  ) {
    if (node.name) {
      anchors.push({ role: "name", node: node.name });
    }

    if ("initializer" in node && node.initializer) {
      anchors.push({ role: "initializer", node: node.initializer });
    }

    if ("body" in node && node.body) {
      anchors.push({ role: "body", node: node.body });
    }
  } else if (ts.isExpressionStatement(node)) {
    anchors.push({ role: "expression", node: node.expression });
  } else if (
    (ts.isReturnStatement(node) || ts.isThrowStatement(node)) &&
    node.expression
  ) {
    anchors.push({ role: "expression", node: node.expression });
  }

  const deduped = new Map<string, RegionAnchor>();

  for (const [anchorIndex, anchor] of anchors.entries()) {
    const start = anchor.node.getStart(sourceFile);
    const end = anchor.node.getEnd();
    const key = `${start}:${end}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        id: `group:${groupIndex}:anchor:${anchorIndex}`,
        role: anchor.role,
        range: rangeOf(sourceFile, start, end),
        source: source.slice(start, end),
      });
    }
  }

  return [...deduped.values()];
}

function variableStatementOf(node: ts.VariableDeclaration): ts.VariableStatement | null {
  const declarationList = node.parent;
  const statement = declarationList.parent;

  return ts.isVariableStatement(statement) ? statement : null;
}

function groupLabel(node: ts.Node, kind: string): string {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    return `variable(${node.name.text})`;
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isPropertyDeclaration(node)) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return `${kind}(${node.name.text})`;
  }

  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
    const name = calleeRootName(node.expression.expression);

    if (name !== null) {
      return `call(${name})`;
    }
  }

  return kind;
}

function calleeRootName(expression: ts.Expression): string | null {
  let current: ts.Expression = expression;

  while (true) {
    if (ts.isIdentifier(current)) {
      return current.text;
    }

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

import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  SourceDocument,
  SourceRange,
  SubjectContext,
} from "../../domain/model.ts";

export type CandidateAnchor = {
  id: string;
  role: string;
  range: SourceRange;
  source: string;
};

export type Candidate = {
  id: string;
  kind: string;
  label: string;
  range: SourceRange;
  source: string;
  context: SubjectContext;
  anchors: CandidateAnchor[];
};

export function extractCandidateAnchors(document: SourceDocument): Candidate[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const raw: Array<{ node: ts.Node; kind: string }> = [];

  function visit(node: ts.Node): void {
    const kind = candidateKind(node);

    if (kind !== null) {
      raw.push({ node, kind });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  raw.sort(
    (left, right) =>
      left.node.getStart(sourceFile) - right.node.getStart(sourceFile) ||
      left.node.getEnd() - right.node.getEnd(),
  );

  return raw.map(({ node, kind }, index) =>
    candidateFromNode(sourceFile, document.source, node, kind, index),
  );
}

function candidateKind(node: ts.Node): string | null {
  if (ts.isVariableDeclaration(node)) {
    return "variable-declaration";
  }

  if (ts.isExpressionStatement(node)) {
    return "expression-statement";
  }

  if (ts.isReturnStatement(node)) {
    return "return-statement";
  }

  if (ts.isThrowStatement(node)) {
    return "throw-statement";
  }

  if (ts.isFunctionDeclaration(node)) {
    return "function-declaration";
  }

  if (ts.isMethodDeclaration(node)) {
    return "method-declaration";
  }

  if (ts.isClassDeclaration(node)) {
    return "class-declaration";
  }

  if (ts.isPropertyDeclaration(node)) {
    return "property-declaration";
  }

  return null;
}

function candidateFromNode(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  kind: string,
  index: number,
): Candidate {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const anchors = anchorsForNode(sourceFile, source, node, index);

  return {
    id: `candidate:${index}`,
    kind,
    label: candidateLabel(node, kind),
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    context: structuralContext(node),
    anchors,
  };
}

function structuralContext(node: ts.Node): SubjectContext {
  const enclosingCalls: string[] = [];
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isCallExpression(current)) {
      const name = calleeRootName(current.expression);

      if (name !== null && !enclosingCalls.includes(name)) {
        enclosingCalls.push(name);
      }
    }

    current = current.parent;
  }

  return { enclosingCalls };
}

function anchorsForNode(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  candidateIndex: number,
): CandidateAnchor[] {
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

  const deduped = new Map<string, CandidateAnchor>();

  for (const [anchorIndex, anchor] of anchors.entries()) {
    const start = anchor.node.getStart(sourceFile);
    const end = anchor.node.getEnd();
    const key = `${start}:${end}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        id: `candidate:${candidateIndex}:anchor:${anchorIndex}`,
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

function candidateLabel(node: ts.Node, kind: string): string {
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

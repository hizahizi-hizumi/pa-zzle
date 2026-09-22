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
  compactContext: SubjectContext;
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
    compactContext: compactStructuralContext(node),
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

function compactStructuralContext(node: ts.Node): SubjectContext {
  const enclosingCallDetails = enclosingCallsOf(node);
  const captures = structuralCaptures(node);
  const selfCall = callContextOfNode(node);

  return {
    enclosingCalls: enclosingCallDetails.map((call) => call.callee),
    nodeKind: ts.SyntaxKind[node.kind],
    ...(selfCall === null ? {} : { selfCall }),
    ...(enclosingCallDetails.length === 0 ? {} : { enclosingCallDetails }),
    ...(Object.keys(captures).length === 0 ? {} : { captures }),
  };
}

function enclosingCallsOf(
  node: ts.Node,
): Array<{ callee: string; label?: string }> {
  const calls: Array<{ callee: string; label?: string }> = [];
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isCallExpression(current)) {
      const call = callContext(current);

      if (
        call !== null &&
        !calls.some(
          (item) => item.callee === call.callee && item.label === call.label,
        )
      ) {
        calls.push(call);
      }
    }

    current = current.parent;
  }

  return calls;
}

function callContextOfNode(
  node: ts.Node,
): { callee: string; label?: string } | null {
  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
    return callContext(node.expression);
  }

  return null;
}

function callContext(
  call: ts.CallExpression,
): { callee: string; label?: string } | null {
  const callee = calleeRootName(call.expression);

  if (callee === null) {
    return null;
  }

  const label = stringLiteralText(call.arguments[0]);

  return label === null ? { callee } : { callee, label };
}

function structuralCaptures(node: ts.Node): Record<string, string> {
  const captures: Record<string, string> = {};

  if (ts.isVariableDeclaration(node)) {
    captures.name = node.name.getText();

    if (node.initializer) {
      captures.initializerKind = ts.SyntaxKind[node.initializer.kind];

      if (ts.isCallExpression(node.initializer)) {
        const callee = calleeRootName(node.initializer.expression);

        if (callee !== null) {
          captures.initializerCallee = callee;
        }
      }
    }
  } else if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isPropertyDeclaration(node)) &&
    node.name
  ) {
    captures.name = node.name.getText();
  } else if (
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression)
  ) {
    const callee = calleeRootName(node.expression.expression);

    if (callee !== null) {
      captures.callee = callee;
    }
  } else if (
    (ts.isReturnStatement(node) || ts.isThrowStatement(node)) &&
    node.expression &&
    ts.isCallExpression(node.expression)
  ) {
    const callee = calleeRootName(node.expression.expression);

    if (callee !== null) {
      captures.expressionCallee = callee;
    }
  }

  return captures;
}

function stringLiteralText(node: ts.Expression | undefined): string | null {
  return node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
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

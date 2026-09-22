import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  SourceDocument,
  SourceRange,
  SubjectContext,
} from "../../domain/model.ts";
import {
  type Candidate,
  type CandidateAnchor,
  extractCandidateAnchors,
} from "../candidate-anchor/extract.ts";

export function extractRelationAwareCandidates(
  document: SourceDocument,
): Candidate[] {
  return [
    ...extractCandidateAnchors(document),
    ...extractRelationGroupCandidates(document),
  ];
}

export function extractRelationGroupCandidates(
  document: SourceDocument,
): Candidate[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const groups: Array<{ container: ts.Node; members: readonly ts.Statement[] }> = [];

  function visit(node: ts.Node): void {
    const members = statementChildren(node);

    if (members !== null) {
      groups.push(...adjacentStructuralGroups(node, members));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return groups.map(({ container, members }, index) =>
    relationGroupCandidate(
      sourceFile,
      document.source,
      container,
      members,
      index,
    ),
  );
}

function adjacentStructuralGroups(
  container: ts.Node,
  statements: readonly ts.Statement[],
): Array<{ container: ts.Node; members: readonly ts.Statement[] }> {
  const groups: Array<{ container: ts.Node; members: readonly ts.Statement[] }> = [];
  let runStart = 0;

  while (runStart < statements.length) {
    const signature = relationSignature(statements[runStart]);

    if (signature === null) {
      runStart += 1;
      continue;
    }

    let runEnd = runStart + 1;

    while (
      runEnd < statements.length &&
      relationSignature(statements[runEnd]) === signature
    ) {
      runEnd += 1;
    }

    if (runEnd - runStart >= 2) {
      groups.push({
        container,
        members: statements.slice(runStart, runEnd),
      });
    }

    runStart = runEnd;
  }

  return groups;
}

function relationSignature(statement: ts.Statement): string | null {
  if (ts.isExpressionStatement(statement)) {
    return `expression:${structuralFingerprint(statement.expression)}`;
  }

  if (ts.isVariableStatement(statement)) {
    return `variable:${statement.declarationList.declarations
      .map((declaration) =>
        declaration.initializer
          ? structuralFingerprint(declaration.initializer)
          : "uninitialized",
      )
      .join(",")}`;
  }

  if (ts.isReturnStatement(statement)) {
    return `return:${
      statement.expression
        ? structuralFingerprint(statement.expression)
        : "empty"
    }`;
  }

  if (ts.isThrowStatement(statement)) {
    return `throw:${structuralFingerprint(statement.expression)}`;
  }

  return null;
}

function structuralFingerprint(node: ts.Node): string {
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return "literal";
  }

  if (ts.isIdentifier(node)) {
    return `identifier:${node.text}`;
  }

  const children: string[] = [];
  ts.forEachChild(node, (child) => {
    children.push(structuralFingerprint(child));
  });

  return `${ts.SyntaxKind[node.kind]}(${children.join(",")})`;
}

function relationGroupCandidate(
  sourceFile: ts.SourceFile,
  source: string,
  container: ts.Node,
  members: readonly ts.Statement[],
  index: number,
): Candidate {
  const first = members[0];
  const last = members.at(-1);

  if (!first || !last) {
    throw new Error("relation groupには2件以上のmemberが必要です。");
  }

  const start = first.getStart(sourceFile);
  const end = last.getEnd();

  return {
    id: `relation-group:${index}`,
    kind: "relation-group",
    label: `siblings(${ts.SyntaxKind[container.kind]}:${members.length})`,
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    context: relationContext(container, members),
    anchors: relationAnchors(sourceFile, source, container, members, index),
  };
}

function relationContext(
  container: ts.Node,
  members: readonly ts.Statement[],
): SubjectContext {
  return {
    enclosingCalls: enclosingCallNames(container),
    relation: {
      kind: "siblings",
      containerKind: ts.SyntaxKind[container.kind],
      memberKinds: members.map((member) => ts.SyntaxKind[member.kind]),
    },
  };
}

function relationAnchors(
  sourceFile: ts.SourceFile,
  source: string,
  container: ts.Node,
  members: readonly ts.Statement[],
  groupIndex: number,
): CandidateAnchor[] {
  const first = members[0];
  const last = members.at(-1);

  if (!first || !last) {
    throw new Error("relation groupには2件以上のmemberが必要です。");
  }

  const raw: Array<{ role: string; start: number; end: number }> = [
    {
      role: "members",
      start: first.getStart(sourceFile),
      end: last.getEnd(),
    },
    {
      role: "container",
      start: container.getStart(sourceFile),
      end: container.getEnd(),
    },
  ];
  const enclosingStatement = nearestEnclosingStatement(container);

  if (enclosingStatement !== null) {
    raw.push({
      role: "enclosing-statement",
      start: enclosingStatement.getStart(sourceFile),
      end: enclosingStatement.getEnd(),
    });
  }

  const deduped = new Map<string, CandidateAnchor>();

  for (const [anchorIndex, anchor] of raw.entries()) {
    const key = `${anchor.start}:${anchor.end}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        id: `relation-group:${groupIndex}:anchor:${anchorIndex}`,
        role: anchor.role,
        range: rangeOf(sourceFile, anchor.start, anchor.end),
        source: source.slice(anchor.start, anchor.end),
      });
    }
  }

  return [...deduped.values()];
}

function statementChildren(node: ts.Node): readonly ts.Statement[] | null {
  if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
    return node.statements;
  }

  if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
    return node.statements;
  }

  return null;
}

function nearestEnclosingStatement(node: ts.Node): ts.Statement | null {
  let current = node.parent;

  while (current) {
    if (ts.isStatement(current)) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function enclosingCallNames(node: ts.Node): string[] {
  const names: string[] = [];
  let current = node.parent;

  while (current) {
    if (ts.isCallExpression(current)) {
      const name = calleeRootName(current.expression);

      if (name !== null && !names.includes(name)) {
        names.push(name);
      }
    }

    current = current.parent;
  }

  return names;
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

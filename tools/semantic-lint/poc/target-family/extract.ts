import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  SourceDocument,
  SourceRange,
  SubjectContext,
} from "../../domain/model.ts";
import type {
  Candidate,
  CandidateAnchor,
} from "../candidate-anchor/extract.ts";
import { extractRelationGroupCandidates } from "../relation-group/extract.ts";

export type TargetFamily =
  | "callback-statement"
  | "callback-call"
  | "relation-group";

export function extractTargetFamilyCandidates(
  family: TargetFamily,
  document: SourceDocument,
): Candidate[] {
  switch (family) {
    case "callback-statement":
      return extractCallbackStatementCandidates(document);
    case "callback-call":
      return extractCallbackCallCandidates(document);
    case "relation-group":
      return extractRelationGroupCandidates(document);
  }
}

export function extractCallbackStatementCandidates(
  document: SourceDocument,
): Candidate[] {
  const sourceFile = createSourceFile(document);
  const candidates: Candidate[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callbacks = callbackArguments(node);

      for (const callback of callbacks) {
        if (!ts.isBlock(callback.node.body)) {
          continue;
        }

        for (const statement of callback.node.body.statements) {
          candidates.push(
            statementCandidate(
              sourceFile,
              document.source,
              node,
              callback.argumentIndex,
              statement,
              candidates.length,
            ),
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

export function extractCallbackCallCandidates(
  document: SourceDocument,
): Candidate[] {
  const sourceFile = createSourceFile(document);
  const candidates: Candidate[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      for (const callback of callbackArguments(node)) {
        candidates.push(
          callbackCallCandidate(
            sourceFile,
            document.source,
            node,
            callback.argumentIndex,
            candidates.length,
          ),
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

type CallbackArgument = {
  argumentIndex: number;
  node: ts.ArrowFunction | ts.FunctionExpression;
};

function callbackArguments(call: ts.CallExpression): CallbackArgument[] {
  return call.arguments.flatMap((argument, argumentIndex) =>
    ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
      ? [{ argumentIndex, node: argument }]
      : [],
  );
}

function statementCandidate(
  sourceFile: ts.SourceFile,
  source: string,
  call: ts.CallExpression,
  callbackArgumentIndex: number,
  statement: ts.Statement,
  index: number,
): Candidate {
  const start = statement.getStart(sourceFile);
  const end = statement.getEnd();
  const callee = calleeName(call.expression);

  return {
    id: `callback-statement:${index}`,
    kind: "callback-statement",
    label: `statement(${callee})`,
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    context: callContext(call, callbackArgumentIndex),
    anchors: [anchor(sourceFile, source, statement, `callback-statement:${index}`)],
  };
}

function callbackCallCandidate(
  sourceFile: ts.SourceFile,
  source: string,
  call: ts.CallExpression,
  callbackArgumentIndex: number,
  index: number,
): Candidate {
  const location = enclosingStatement(call) ?? call;
  const start = location.getStart(sourceFile);
  const end = location.getEnd();
  const callee = calleeName(call.expression);

  return {
    id: `callback-call:${index}`,
    kind: "callback-call",
    label: `callback(${callee})`,
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    context: callContext(call, callbackArgumentIndex),
    anchors: [anchor(sourceFile, source, location, `callback-call:${index}`)],
  };
}

function callContext(
  call: ts.CallExpression,
  callbackArgumentIndex: number,
): SubjectContext {
  return {
    enclosingCalls: enclosingCallNames(call),
    call: {
      callee: calleeName(call.expression),
      callbackArgumentIndex,
    },
  };
}

function enclosingCallNames(node: ts.Node): string[] {
  const names = [ts.isCallExpression(node) ? calleeName(node.expression) : ""];
  let current = node.parent;

  while (current) {
    if (ts.isCallExpression(current)) {
      names.push(calleeName(current.expression));
    }
    current = current.parent;
  }

  return names.filter(
    (name, index) => name.length > 0 && names.indexOf(name) === index,
  );
}

function calleeName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return `${calleeName(expression.expression)}.${expression.name.text}`;
  }

  if (ts.isCallExpression(expression)) {
    return calleeName(expression.expression);
  }

  return ts.SyntaxKind[expression.kind];
}

function enclosingStatement(node: ts.Node): ts.Statement | null {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isStatement(current)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

function anchor(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  idPrefix: string,
): CandidateAnchor {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();

  return {
    id: `${idPrefix}:anchor:0`,
    role: "self",
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
  };
}

function createSourceFile(document: SourceDocument): ts.SourceFile {
  return ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
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

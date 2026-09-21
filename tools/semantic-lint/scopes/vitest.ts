import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  ScopeId,
  SourceDocument,
  SourceRange,
  Subject,
} from "../domain/model.ts";
import { type ScopeRegistry, subjectId } from "./registry.ts";

type VitestScope =
  | "vitest.test"
  | "vitest.beforeEach"
  | "vitest.describe";

type Candidate = {
  scope: VitestScope;
  symbol: string;
  start: number;
  end: number;
};

export function registerVitestScopes(
  registry: ScopeRegistry,
): void {
  const cache = new Map<string, Map<VitestScope, Subject[]>>();

  for (const scope of [
    "vitest.test",
    "vitest.beforeEach",
    "vitest.describe",
  ] as const) {
    registry.register(scope, (document) => {
      const key = document.path + "\0" + document.source;
      let byScope = cache.get(key);

      if (!byScope) {
        byScope = extractAllVitestSubjects(document);
        cache.set(key, byScope);
      }

      return byScope.get(scope) ?? [];
    });
  }
}

function extractAllVitestSubjects(
  document: SourceDocument,
): Map<VitestScope, Subject[]> {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const candidates: Candidate[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const candidate = classifyCall(node, sourceFile);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  candidates.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );

  const counts = new Map<VitestScope, number>();
  const byScope = new Map<VitestScope, Subject[]>();

  for (const candidate of candidates) {
    const index = counts.get(candidate.scope) ?? 0;
    counts.set(candidate.scope, index + 1);
    const subjects = byScope.get(candidate.scope) ?? [];

    subjects.push({
      id: subjectId(candidate.scope, document.path, index),
      scope: candidate.scope,
      path: document.path,
      range: rangeOf(sourceFile, candidate.start, candidate.end),
      symbol: candidate.symbol,
      source: document.source.slice(candidate.start, candidate.end),
    });
    byScope.set(candidate.scope, subjects);
  }

  return byScope;
}

function classifyCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
): Candidate | null {
  const rootName = calleeRootName(node.expression);

  if (rootName === "beforeEach") {
    if (!isDirectOrModifiedCall(node.expression, "beforeEach")) {
      return null;
    }

    return {
      scope: "vitest.beforeEach",
      symbol: "beforeEach",
      start: node.getStart(sourceFile),
      end: node.getEnd(),
    };
  }

  if (rootName !== "test" && rootName !== "it" && rootName !== "describe") {
    return null;
  }

  const title = literalTitle(node.arguments[0]);

  if (title === null) {
    return null;
  }

  const kind = rootName === "describe" ? "describe" : "test";

  return {
    scope: kind === "describe" ? "vitest.describe" : "vitest.test",
    symbol: `${kind}(${JSON.stringify(title)})`,
    start: node.getStart(sourceFile),
    end: node.getEnd(),
  };
}

function calleeRootName(
  expression: ts.Expression,
): string | null {
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

function isDirectOrModifiedCall(
  expression: ts.Expression,
  name: string,
): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === name;
  }

  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  return calleeRootName(expression) === name;
}

function literalTitle(node: ts.Expression | undefined): string | null {
  if (!node) {
    return null;
  }

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return null;
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

export function isVitestScope(scope: ScopeId): scope is VitestScope {
  return (
    scope === "vitest.test" ||
    scope === "vitest.beforeEach" ||
    scope === "vitest.describe"
  );
}

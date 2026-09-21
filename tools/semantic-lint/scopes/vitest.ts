import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type {
  ScopeId,
  SourceDocument,
  SourceRange,
  Subject,
  TargetKind,
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
  targets: {
    start: number;
    end: number;
  }[];
};

export function registerVitestScopes(
  registry: ScopeRegistry,
): void {
  const cache = new Map<string, Candidate[]>();

  for (const scope of [
    "vitest.test",
    "vitest.beforeEach",
    "vitest.describe",
  ] as const) {
    registry.register(scope, ["self", "statement"], (document, target) => {
      const key = document.path + "\0" + document.source;
      let candidates = cache.get(key);

      if (!candidates) {
        candidates = extractAllVitestCandidates(document);
        cache.set(key, candidates);
      }

      return materializeSubjects(
        document,
        candidates.filter((candidate) => candidate.scope === scope),
        target,
      );
    });
  }
}

function extractAllVitestCandidates(
  document: SourceDocument,
): Candidate[] {
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
  return candidates.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
}

function materializeSubjects(
  document: SourceDocument,
  candidates: Candidate[],
  target: TargetKind,
): Subject[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const subjects: Subject[] = [];

  for (const [contextIndex, candidate] of candidates.entries()) {
    const contextRange = rangeOf(sourceFile, candidate.start, candidate.end);

    if (target === "self") {
      subjects.push({
        id: subjectId(candidate.scope, target, document.path, contextIndex),
        contextScope: candidate.scope,
        targetKind: target,
        path: document.path,
        range: contextRange,
        symbol: candidate.symbol,
        source: document.source.slice(candidate.start, candidate.end),
        contextRange,
        contextSymbol: candidate.symbol,
      });
      continue;
    }

    for (const [targetIndex, statement] of candidate.targets.entries()) {
      subjects.push({
        id: subjectId(
          candidate.scope,
          target,
          document.path,
          contextIndex,
          targetIndex,
        ),
        contextScope: candidate.scope,
        targetKind: target,
        path: document.path,
        range: rangeOf(sourceFile, statement.start, statement.end),
        source: document.source.slice(statement.start, statement.end),
        contextRange,
        contextSymbol: candidate.symbol,
      });
    }
  }

  return subjects;
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
      targets: callbackTargets(node, sourceFile),
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
    targets: callbackTargets(node, sourceFile),
  };
}

function callbackTargets(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
): { start: number; end: number }[] {
  const callback = [...node.arguments]
    .reverse()
    .find(
      (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
        ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
    );

  if (!callback) {
    return [];
  }

  if (ts.isBlock(callback.body)) {
    return callback.body.statements.map((statement) => ({
      start: statement.getStart(sourceFile),
      end: statement.getEnd(),
    }));
  }

  return [
    {
      start: callback.body.getStart(sourceFile),
      end: callback.body.getEnd(),
    },
  ];
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

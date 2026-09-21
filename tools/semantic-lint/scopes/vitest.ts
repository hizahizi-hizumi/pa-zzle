import { extname } from "node:path";

import type {
  ScopeId,
  SourceDocument,
  SourceRange,
  Subject,
} from "../domain/model.ts";
import { type ScopeRegistry, subjectId } from "./registry.ts";

type Node = {
  expression?: Node;
  arguments?: Node[];
  name?: Node;
  text?: string;
  kind?: number;
  getStart(sourceFile?: Node): number;
  getEnd(): number;
  getText(sourceFile?: Node): string;
};

type SourceFile = Node & {
  getLineAndCharacterOfPosition(position: number): {
    line: number;
    character: number;
  };
};

type TypeScriptApi = {
  ScriptTarget: { Latest: number };
  ScriptKind: {
    JS: number;
    JSX: number;
    TS: number;
    TSX: number;
  };
  createSourceFile(
    fileName: string,
    sourceText: string,
    languageVersion: number,
    setParentNodes: boolean,
    scriptKind: number,
  ): SourceFile;
  forEachChild(node: Node, visitor: (child: Node) => void): void;
  isCallExpression(node: Node): boolean;
  isIdentifier(node: Node): boolean;
  isPropertyAccessExpression(node: Node): boolean;
  isStringLiteralLike(node: Node): boolean;
  isNoSubstitutionTemplateLiteral(node: Node): boolean;
};

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

export async function loadTypeScript(
  baseDirectory: string,
): Promise<TypeScriptApi> {
  const modulePath = Bun.resolveSync("typescript", baseDirectory);
  const module = await import(modulePath);

  return module as unknown as TypeScriptApi;
}

export function registerVitestScopes(
  registry: ScopeRegistry,
  ts: TypeScriptApi,
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
        byScope = extractAllVitestSubjects(document, ts);
        cache.set(key, byScope);
      }

      return byScope.get(scope) ?? [];
    });
  }
}

function extractAllVitestSubjects(
  document: SourceDocument,
  ts: TypeScriptApi,
): Map<VitestScope, Subject[]> {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path, ts),
  );
  const candidates: Candidate[] = [];

  function visit(node: Node): void {
    if (ts.isCallExpression(node)) {
      const candidate = classifyCall(node, sourceFile, ts);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  candidates.sort((left, right) => left.start - right.start || left.end - right.end);

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
  node: Node,
  sourceFile: SourceFile,
  ts: TypeScriptApi,
): Candidate | null {
  const argumentsList = node.arguments ?? [];
  const expression = node.expression;

  if (!expression) {
    return null;
  }

  const rootName = calleeRootName(expression, ts);

  if (rootName === "beforeEach") {
    if (!isDirectOrModifiedCall(expression, "beforeEach", ts)) {
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

  const title = literalTitle(argumentsList[0], ts);

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

function calleeRootName(expression: Node, ts: TypeScriptApi): string | null {
  let current: Node | undefined = expression;

  while (current) {
    if (ts.isIdentifier(current)) {
      return current.text ?? null;
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

  return null;
}

function isDirectOrModifiedCall(
  expression: Node,
  name: string,
  ts: TypeScriptApi,
): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === name;
  }

  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  return calleeRootName(expression, ts) === name;
}

function literalTitle(node: Node | undefined, ts: TypeScriptApi): string | null {
  if (!node) {
    return null;
  }

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text ?? "";
  }

  return null;
}

function rangeOf(
  sourceFile: SourceFile,
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

function scriptKind(path: string, ts: TypeScriptApi): number {
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

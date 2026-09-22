import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type { SourceDocument, SourceRange } from "../../domain/model.ts";

export const SELECTOR_CATALOG = [
  {
    id: "variable-declaration",
    description: "個々の変数宣言。変数名・初期値・宣言文全体を指摘位置にできる。",
    example: "const value = createValue();",
  },
  {
    id: "generic-call-statement",
    description: "test/describe/beforeEach以外の、文として実行される関数・メソッド呼び出し。",
    example: "render(<Screen />);",
  },
  {
    id: "return-statement",
    description: "return文。返却式も指摘位置にできる。",
    example: "return value;",
  },
  {
    id: "throw-statement",
    description: "throw文。送出式も指摘位置にできる。",
    example: "throw new Error();",
  },
  {
    id: "function-declaration",
    description: "function宣言。関数名・bodyを指摘位置にできる。",
    example: "function createValue() {}",
  },
  {
    id: "method-declaration",
    description: "class/objectのmethod宣言。method名・bodyを指摘位置にできる。",
    example: "createValue() {}",
  },
  {
    id: "class-declaration",
    description: "class宣言。class名・bodyを指摘位置にできる。",
    example: "class ValueStore {}",
  },
  {
    id: "property-declaration",
    description: "class property宣言。property名・initializerを指摘位置にできる。",
    example: "value = createValue();",
  },
  {
    id: "vitest-test",
    description: "Vitestのtest/it呼び出し全体。個々のテストケース構造そのものを判定する。",
    example: "test(\"期待動作こと\", () => {});",
  },
  {
    id: "vitest-describe",
    description: "Vitestのdescribe呼び出し全体。複数testを含むグループ構造そのものを判定する。",
    example: "describe(\"target\", () => {});",
  },
  {
    id: "vitest-before-each",
    description: "VitestのbeforeEach呼び出し全体。共通事前処理そのものを判定する。",
    example: "beforeEach(() => {});",
  },
] as const;

export type SelectorId = (typeof SELECTOR_CATALOG)[number]["id"];

export type SelectorAnchor = {
  id: string;
  role: string;
  range: SourceRange;
  source: string;
};

export type SelectorCandidate = {
  id: string;
  selectorId: SelectorId;
  label: string;
  range: SourceRange;
  source: string;
  anchors: SelectorAnchor[];
};

type MatchedNode = {
  selectorId: SelectorId;
  node: ts.Node;
};

export function extractSelectedCandidates(
  document: SourceDocument,
  selectedSelectors: ReadonlySet<SelectorId>,
): SelectorCandidate[] {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const matches: MatchedNode[] = [];

  function visit(node: ts.Node): void {
    const selectorId = selectorForNode(node);

    if (selectorId !== null && selectedSelectors.has(selectorId)) {
      matches.push({ selectorId, node });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  matches.sort(
    (left, right) =>
      left.node.getStart(sourceFile) - right.node.getStart(sourceFile) ||
      left.node.getEnd() - right.node.getEnd() ||
      left.selectorId.localeCompare(right.selectorId),
  );

  return matches.map((match, index) =>
    candidateFromNode(sourceFile, document.source, match, index),
  );
}

export function countCandidatesBySelector(
  document: SourceDocument,
): Map<SelectorId, number> {
  const counts = new Map<SelectorId, number>();
  const allSelectors = new Set<SelectorId>(SELECTOR_CATALOG.map((item) => item.id));

  for (const candidate of extractSelectedCandidates(document, allSelectors)) {
    counts.set(candidate.selectorId, (counts.get(candidate.selectorId) ?? 0) + 1);
  }

  return counts;
}

function selectorForNode(node: ts.Node): SelectorId | null {
  if (ts.isVariableDeclaration(node)) return "variable-declaration";
  if (ts.isReturnStatement(node)) return "return-statement";
  if (ts.isThrowStatement(node)) return "throw-statement";
  if (ts.isFunctionDeclaration(node)) return "function-declaration";
  if (ts.isMethodDeclaration(node)) return "method-declaration";
  if (ts.isClassDeclaration(node)) return "class-declaration";
  if (ts.isPropertyDeclaration(node)) return "property-declaration";

  if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) {
    return null;
  }

  const rootName = calleeRootName(node.expression.expression);

  if (rootName === "test" || rootName === "it") return "vitest-test";
  if (rootName === "describe") return "vitest-describe";
  if (rootName === "beforeEach") return "vitest-before-each";
  return "generic-call-statement";
}

function candidateFromNode(
  sourceFile: ts.SourceFile,
  source: string,
  match: MatchedNode,
  index: number,
): SelectorCandidate {
  const start = match.node.getStart(sourceFile);
  const end = match.node.getEnd();

  return {
    id: `selector-candidate:${index}`,
    selectorId: match.selectorId,
    label: candidateLabel(match.node, match.selectorId),
    range: rangeOf(sourceFile, start, end),
    source: source.slice(start, end),
    anchors: anchorsForNode(sourceFile, source, match.node, index),
  };
}

function anchorsForNode(
  sourceFile: ts.SourceFile,
  source: string,
  node: ts.Node,
  candidateIndex: number,
): SelectorAnchor[] {
  const nodes: Array<{ role: string; node: ts.Node }> = [{ role: "self", node }];

  if (ts.isVariableDeclaration(node)) {
    const statement = variableStatementOf(node);
    if (statement !== null) nodes.push({ role: "statement", node: statement });
    nodes.push({ role: "name", node: node.name });
    if (node.initializer) nodes.push({ role: "initializer", node: node.initializer });
  } else if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isPropertyDeclaration(node)
  ) {
    if (node.name) nodes.push({ role: "name", node: node.name });
    if ("initializer" in node && node.initializer) {
      nodes.push({ role: "initializer", node: node.initializer });
    }
    if ("body" in node && node.body) nodes.push({ role: "body", node: node.body });
  } else if (ts.isExpressionStatement(node)) {
    nodes.push({ role: "expression", node: node.expression });
  } else if (
    (ts.isReturnStatement(node) || ts.isThrowStatement(node)) &&
    node.expression
  ) {
    nodes.push({ role: "expression", node: node.expression });
  }

  const deduped = new Map<string, SelectorAnchor>();

  for (const [anchorIndex, item] of nodes.entries()) {
    const start = item.node.getStart(sourceFile);
    const end = item.node.getEnd();
    const key = `${start}:${end}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        id: `selector-candidate:${candidateIndex}:anchor:${anchorIndex}`,
        role: item.role,
        range: rangeOf(sourceFile, start, end),
        source: source.slice(start, end),
      });
    }
  }

  return [...deduped.values()];
}

function variableStatementOf(node: ts.VariableDeclaration): ts.VariableStatement | null {
  const statement = node.parent.parent;
  return ts.isVariableStatement(statement) ? statement : null;
}

function candidateLabel(node: ts.Node, selectorId: SelectorId): string {
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
    return `${selectorId}(${node.name.text})`;
  }

  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
    const name = calleeRootName(node.expression.expression);
    return name === null ? selectorId : `${selectorId}(${name})`;
  }

  return selectorId;
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

function rangeOf(sourceFile: ts.SourceFile, start: number, end: number): SourceRange {
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

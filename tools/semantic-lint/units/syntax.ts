import { extname } from "node:path";
import ts from "@typescript/typescript6";

import type { SourceDocument } from "../domain/model.ts";

/** 1始まりの行範囲。unit抽出・位置特定・dedupeで共通に使う。 */
export type LineSpan = {
  startLine: number;
  endLine: number;
};

/** 言語構文上の関数本体。名前ではなく構文種別だけで判定する。 */
export type FunctionNode = {
  node: ts.SignatureDeclaration;
  span: LineSpan;
  /** 関数本体の直下にある文。式本体のarrowでは本体式を1つの文として扱う。 */
  bodyStatements: LineSpan[];
  /** 関数が呼び出しの引数として渡されているとき、その呼び出しの開始行。 */
  callStartLine?: number;
};

export type ParsedDocument = {
  document: SourceDocument;
  sourceFile: ts.SourceFile;
  lines: string[];
  /** 文書順 (開始位置昇順、同位置なら外側が先) の関数。 */
  functions: FunctionNode[];
  /** 他の文を含まない文。import宣言は除く。 */
  leafStatements: LineSpan[];
  /** ファイル直下の文。 */
  topLevelStatements: Array<LineSpan & { kind: ts.SyntaxKind }>;
};

const parsedCache = new Map<string, ParsedDocument>();

export function parseDocument(document: SourceDocument): ParsedDocument {
  const key = document.path + "\0" + document.source;
  const cached = parsedCache.get(key);

  if (cached) {
    return cached;
  }

  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(document.path),
  );
  const functions: FunctionNode[] = [];
  const leafStatements: LineSpan[] = [];

  function visit(node: ts.Node): boolean {
    let containsStatement = false;

    ts.forEachChild(node, (child) => {
      if (visit(child)) {
        containsStatement = true;
      }
    });

    if (isFunctionLike(node)) {
      const call = ts.isCallExpression(node.parent) ? node.parent : undefined;
      functions.push({
        node,
        span: spanOf(sourceFile, node),
        bodyStatements: bodyStatementsOf(sourceFile, node),
        ...(call === undefined || !call.arguments.some((argument) => argument === node)
          ? {}
          : { callStartLine: spanOf(sourceFile, call).startLine }),
      });
    }

    if (!isStatementNode(node)) {
      return containsStatement;
    }

    if (!containsStatement && node.kind !== ts.SyntaxKind.ImportDeclaration) {
      leafStatements.push(spanOf(sourceFile, node));
    }

    return true;
  }

  visit(sourceFile);

  functions.sort(
    (left, right) =>
      left.node.getStart(sourceFile) - right.node.getStart(sourceFile) ||
      right.node.getEnd() - left.node.getEnd(),
  );
  leafStatements.sort(compareSpans);

  const parsed: ParsedDocument = {
    document,
    sourceFile,
    lines: document.source.split("\n"),
    functions,
    leafStatements,
    topLevelStatements: sourceFile.statements.map((statement) => ({
      ...spanOf(sourceFile, statement),
      kind: statement.kind,
    })),
  };

  parsedCache.set(key, parsed);
  return parsed;
}

export function spanOf(sourceFile: ts.SourceFile, node: ts.Node): LineSpan {
  return {
    startLine:
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1,
    endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
  };
}

export function lineCount(span: LineSpan): number {
  return span.endLine - span.startLine + 1;
}

export function containsSpan(outer: LineSpan, inner: LineSpan): boolean {
  return outer.startLine <= inner.startLine && outer.endLine >= inner.endLine;
}

export function compareSpans(left: LineSpan, right: LineSpan): number {
  return left.startLine - right.startLine || right.endLine - left.endLine;
}

/** `51| code` 形式で行番号付きのテキストを作る。 */
export function numberedLines(lines: string[], span: LineSpan): string {
  const width = String(span.endLine).length;
  const result: string[] = [];

  for (let line = span.startLine; line <= span.endLine; line += 1) {
    result.push(`${String(line).padStart(width, " ")}| ${lines[line - 1] ?? ""}`);
  }

  return result.join("\n");
}

/** 空行・コメントだけの行・括弧や区切り記号だけの行は位置特定の候補にしない。 */
export function isLocatableLine(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return false;
  }

  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  ) {
    return false;
  }

  return !/^[\s{}()[\];,<>/]*$/.test(trimmed);
}

function isFunctionLike(node: ts.Node): node is ts.SignatureDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function bodyStatementsOf(
  sourceFile: ts.SourceFile,
  node: ts.SignatureDeclaration,
): LineSpan[] {
  const body = (node as { body?: ts.Node }).body;

  if (body === undefined) {
    return [];
  }

  if (ts.isBlock(body)) {
    return body.statements.map((statement) => spanOf(sourceFile, statement));
  }

  return [spanOf(sourceFile, body)];
}

const STATEMENT_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.LabeledStatement,
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.ContinueStatement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
]);

function isStatementNode(node: ts.Node): boolean {
  return STATEMENT_KINDS.has(node.kind);
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

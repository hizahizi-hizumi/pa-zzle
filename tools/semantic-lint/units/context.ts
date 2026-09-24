import type { ContextStore, UnitExtractionOptions } from "./model.ts";
import {
  containsSpan,
  type FunctionNode,
  type LineSpan,
  lineCount,
  numberedLines,
  type ParsedDocument,
} from "./syntax.ts";

const SYMBOL_LENGTH = 80;

/** import宣言は全文、その他のトップレベル文は先頭行だけを並べたファイル概要。 */
export function buildOutline(parsed: ParsedDocument): string {
  const rows: string[] = [];

  for (const statement of parsed.topLevelStatements) {
    const isImport = parsed.lines[statement.startLine - 1]
      ?.trimStart()
      .startsWith("import ");

    if (isImport) {
      rows.push(numberedLines(parsed.lines, statement));
      continue;
    }

    const head = numberedLines(parsed.lines, {
      startLine: statement.startLine,
      endLine: statement.startLine,
    });
    rows.push(
      lineCount(statement) > 1
        ? `${head} … (through line ${statement.endLine})`
        : head,
    );
  }

  return rows.join("\n");
}

/**
 * 関数の本文を、内側にある複数行の関数の中身を畳んだ形で行番号付きにする。
 * 外側の単位を文脈として渡すときに、兄弟の本文でtokenを使いすぎないためのもの。
 */
export function foldedFunctionSource(
  parsed: ParsedDocument,
  target: LineSpan,
  nested: readonly FunctionNode[],
): string {
  const folds = outermostInside(target, nested).filter(
    (fn) => lineCount(fn.span) > 2,
  );
  const rows: string[] = [];
  let line = target.startLine;

  for (const fold of folds) {
    if (fold.span.startLine < line) {
      continue;
    }

    rows.push(
      numberedLines(parsed.lines, {
        startLine: line,
        endLine: fold.span.startLine,
      }),
      `    … (lines ${fold.span.startLine + 1}-${fold.span.endLine - 1} folded)`,
    );
    line = fold.span.endLine;
  }

  rows.push(
    numberedLines(parsed.lines, { startLine: line, endLine: target.endLine }),
  );

  return rows.join("\n");
}

/** 外側の単位を畳んだ本文として文脈に登録し、外側から順にidを返す。 */
export function ancestorContextIds(options: {
  parsed: ParsedDocument;
  ancestors: readonly FunctionNode[];
  contexts: ContextStore;
  unitOptions: UnitExtractionOptions;
}): string[] {
  const { parsed, ancestors, contexts, unitOptions } = options;

  if (unitOptions.contextMode === "file") {
    return [fileContextId(parsed, contexts)];
  }

  return ancestors.map((ancestor) =>
    contexts.add(
      `folded:${ancestor.span.startLine}-${ancestor.span.endLine}`,
      `Enclosing function at lines ${ancestor.span.startLine}-${ancestor.span.endLine}. Bodies of functions nested in it are folded.`,
      () => foldedFunctionSource(parsed, ancestor.span, parsed.functions),
    ),
  );
}

export function fileContextId(
  parsed: ParsedDocument,
  contexts: ContextStore,
): string {
  const whole = { startLine: 1, endLine: parsed.lines.length };

  return contexts.add("file", "The whole file.", () =>
    numberedLines(parsed.lines, whole),
  );
}

export function symbolOf(parsed: ParsedDocument, span: LineSpan): string {
  const head = (parsed.lines[span.startLine - 1] ?? "").trim();

  return head.length > SYMBOL_LENGTH
    ? head.slice(0, SYMBOL_LENGTH - 1) + "…"
    : head;
}

function outermostInside(
  target: LineSpan,
  functions: readonly FunctionNode[],
): FunctionNode[] {
  const inside = functions.filter(
    (fn) =>
      containsSpan(target, fn.span) &&
      !(
        fn.span.startLine === target.startLine &&
        fn.span.endLine === target.endLine
      ),
  );

  return inside
    .filter(
      (fn) =>
        !inside.some(
          (other) =>
            other !== fn &&
            containsSpan(other.span, fn.span) &&
            !(
              other.span.startLine === fn.span.startLine &&
              other.span.endLine === fn.span.endLine
            ),
        ),
    )
    .sort((left, right) => left.span.startLine - right.span.startLine);
}

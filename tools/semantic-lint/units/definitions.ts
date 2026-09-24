import {
  ancestorContextIds,
  fileContextId,
  symbolOf,
} from "./context.ts";
import type {
  BuiltUnit,
  ContextStore,
  UnitDefinition,
  UnitExtractionOptions,
} from "./model.ts";
import {
  containsSpan,
  type FunctionNode,
  type LineSpan,
  lineCount,
  numberedLines,
  type ParsedDocument,
} from "./syntax.ts";

/** 構文上の関数本体。宣言・式・arrow・method・コールバック引数の関数を区別しない。 */
export const functionUnit: UnitDefinition = {
  id: "function",
  description:
    "a function in the source (declaration, expression, arrow function, method, or a callback passed as an argument)",
  build(parsed, options, contexts) {
    const selected = unitFunctions(parsed, options);

    return selected.map((fn): BuiltUnit => {
      const ancestors = ancestorsOf(fn, selected);
      const parent = ancestors.at(-1);
      const parentIndex = parent === undefined ? -1 : selected.indexOf(parent);

      return {
        span: fn.span,
        symbol: symbolOf(parsed, fn.span),
        ...(parentIndex < 0 ? {} : { parentIndex }),
        source: numberedLines(parsed.lines, fn.span),
        locateTargets: fn.bodyStatements,
        contextIds: ancestorContextIds({
          parsed,
          ancestors,
          contexts,
          unitOptions: options,
        }),
      };
    });
  },
};

/** ファイル1つ。大きいファイルはトップレベル文の境界で分割する。 */
export const fileUnit: UnitDefinition = {
  id: "file",
  description: "a whole source file, or a contiguous segment of top-level statements of a large file",
  build(parsed, options, contexts) {
    const segments = fileSegments(parsed, options.maxFileLines);
    const whole = segments.length === 1;

    return segments.map((span) => ({
      span,
      symbol: whole ? parsed.document.path : symbolOf(parsed, span),
      source: numberedLines(parsed.lines, span),
      locateTargets: parsed.leafStatements.filter((statement) =>
        containsSpan(span, statement),
      ),
      contextIds:
        whole || options.contextMode !== "file"
          ? []
          : [fileContextId(parsed, contexts)],
    }));
  },
};

/** 他の文を含まない文。複数行にまたがる文も1単位にする。 */
export const lineUnit: UnitDefinition = {
  id: "line",
  description: "a single statement (one or more lines that contain no other statement)",
  build(parsed, options, contexts) {
    const functions = unitFunctions(parsed, options);

    return parsed.leafStatements.map((statement) => {
      const enclosing = functions.filter((fn) =>
        strictlyContains(fn.span, statement),
      );

      return {
        span: statement,
        symbol: symbolOf(parsed, statement),
        source: numberedLines(parsed.lines, statement),
        locateTargets: [],
        contextIds: enclosingContextIds(parsed, enclosing, contexts, options),
      };
    });
  },
};

export const BUILTIN_UNITS: readonly UnitDefinition[] = [
  fileUnit,
  functionUnit,
  lineUnit,
];

function unitFunctions(
  parsed: ParsedDocument,
  options: UnitExtractionOptions,
): FunctionNode[] {
  if (options.nesting === "all") {
    return parsed.functions;
  }

  return parsed.functions.filter(
    (fn) => lineCount(fn.span) >= options.minFunctionLines,
  );
}

/** 外側から内側の順。 */
function ancestorsOf(
  target: FunctionNode,
  candidates: readonly FunctionNode[],
): FunctionNode[] {
  return candidates.filter(
    (candidate) =>
      candidate !== target &&
      candidate.node.getStart() <= target.node.getStart() &&
      candidate.node.getEnd() >= target.node.getEnd(),
  );
}

/** 直近の関数は全文、それより外側は畳んだ本文を文脈にする。 */
function enclosingContextIds(
  parsed: ParsedDocument,
  enclosing: readonly FunctionNode[],
  contexts: ContextStore,
  options: UnitExtractionOptions,
): string[] {
  if (options.contextMode === "file") {
    return [fileContextId(parsed, contexts)];
  }

  const innermost = enclosing.at(-1);

  if (innermost === undefined) {
    return [];
  }

  const outer = ancestorContextIds({
    parsed,
    ancestors: enclosing.slice(0, -1),
    contexts,
    unitOptions: options,
  });
  const own = contexts.add(
    `full:${innermost.span.startLine}-${innermost.span.endLine}`,
    `Innermost enclosing function at lines ${innermost.span.startLine}-${innermost.span.endLine}.`,
    () => numberedLines(parsed.lines, innermost.span),
  );

  return [...outer, own];
}

function strictlyContains(outer: LineSpan, inner: LineSpan): boolean {
  return (
    containsSpan(outer, inner) &&
    !(outer.startLine === inner.startLine && outer.endLine === inner.endLine)
  );
}

function fileSegments(parsed: ParsedDocument, maxLines: number): LineSpan[] {
  const total = parsed.lines.length;

  if (total <= maxLines || parsed.topLevelStatements.length === 0) {
    return [{ startLine: 1, endLine: total }];
  }

  const segments: LineSpan[] = [];
  let current: LineSpan | null = null;

  for (const statement of parsed.topLevelStatements) {
    if (
      current !== null &&
      statement.endLine - current.startLine + 1 > maxLines
    ) {
      segments.push(current);
      current = null;
    }

    current =
      current === null
        ? { startLine: statement.startLine, endLine: statement.endLine }
        : { startLine: current.startLine, endLine: statement.endLine };
  }

  if (current !== null) {
    segments.push(current);
  }

  return segments;
}

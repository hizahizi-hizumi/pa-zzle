import type { RuleScope, SemanticUnit } from "../types.ts";

type SupportedScope =
  | "vitest:test"
  | "vitest:beforeEach"
  | "vitest:describe";

export function locateVitestUnits(
  source: string,
  scope: SupportedScope,
): SemanticUnit[] {
  const masked = maskNonCode(source);
  const lineStarts = collectLineStarts(source);

  switch (scope) {
    case "vitest:test":
      return locateCalls({
        source,
        masked,
        lineStarts,
        scope,
        pattern:
          /\b(?:test|it)(?:\s*\.\s*(?:each|only|skip|todo|concurrent))*\s*\(/g,
        defaultSymbol: "test",
      });
    case "vitest:beforeEach":
      return locateCalls({
        source,
        masked,
        lineStarts,
        scope,
        pattern: /\bbeforeEach\s*\(/g,
        defaultSymbol: "beforeEach",
      });
    case "vitest:describe":
      return locateCalls({
        source,
        masked,
        lineStarts,
        scope,
        pattern:
          /\bdescribe(?:\s*\.\s*(?:each|only|skip))*\s*\(/g,
        defaultSymbol: "describe",
      });
  }
}

function locateCalls(options: {
  source: string;
  masked: string;
  lineStarts: number[];
  scope: SupportedScope;
  pattern: RegExp;
  defaultSymbol: string;
}): SemanticUnit[] {
  const {
    source,
    masked,
    lineStarts,
    scope,
    pattern,
    defaultSymbol,
  } = options;
  const units: SemanticUnit[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(masked)) !== null) {
    const startOffset = match.index;

    if (!isCallCandidate(masked, startOffset)) {
      continue;
    }

    const firstOpenParen = startOffset + match[0].lastIndexOf("(");
    const firstCloseParen = findMatchingParen(masked, firstOpenParen);

    if (firstCloseParen === null) {
      continue;
    }

    const isEach = /\.\s*each\b/.test(match[0]);
    let argumentOpenParen = firstOpenParen;
    let endOffset = firstCloseParen + 1;

    if (isEach) {
      const nextOpenParen = nextNonWhitespace(masked, firstCloseParen + 1);

      if (nextOpenParen !== null && masked[nextOpenParen] === "(") {
        const secondCloseParen = findMatchingParen(masked, nextOpenParen);

        if (secondCloseParen !== null) {
          argumentOpenParen = nextOpenParen;
          endOffset = secondCloseParen + 1;
        }
      }
    }

    if (source[endOffset] === ";") {
      endOffset += 1;
    }

    const startLine = lineNumberAt(lineStarts, startOffset);
    const endLine = lineNumberAt(lineStarts, Math.max(startOffset, endOffset - 1));
    const title =
      scope === "vitest:beforeEach"
        ? null
        : readStringArgument(source, argumentOpenParen);
    const symbol =
      title === null
        ? defaultSymbol
        : defaultSymbol + "(" + JSON.stringify(title) + ")";

    units.push({
      id: "u" + units.length,
      kind: scope,
      symbol,
      range: {
        startLine,
        endLine,
      },
      source: source.slice(startOffset, endOffset),
    });

    if (endOffset > pattern.lastIndex) {
      pattern.lastIndex = endOffset;
    }
  }

  return units;
}

function isCallCandidate(source: string, startOffset: number): boolean {
  const previousCharacter = source[startOffset - 1];

  if (previousCharacter === ".") {
    return false;
  }

  let index = startOffset - 1;

  while (index >= 0 && /\s/.test(source[index] ?? "")) {
    index -= 1;
  }

  const end = index + 1;

  while (index >= 0 && /[A-Za-z0-9_$]/.test(source[index] ?? "")) {
    index -= 1;
  }

  return source.slice(index + 1, end) !== "function";
}

function findMatchingParen(source: string, openOffset: number): number | null {
  let depth = 0;

  for (let index = openOffset; index < source.length; index += 1) {
    const character = source[index];

    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character !== ")") {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      return index;
    }
  }

  return null;
}

function nextNonWhitespace(source: string, startOffset: number): number | null {
  for (let index = startOffset; index < source.length; index += 1) {
    if (!/\s/.test(source[index] ?? "")) {
      return index;
    }
  }

  return null;
}

function readStringArgument(
  source: string,
  openParenOffset: number,
): string | null {
  let index = openParenOffset + 1;

  while (index < source.length && /\s/.test(source[index] ?? "")) {
    index += 1;
  }

  const quote = source[index];

  if (quote !== '"' && quote !== "'" && quote !== "`") {
    return null;
  }

  const start = index + 1;
  index += 1;

  while (index < source.length) {
    const character = source[index];

    if (character === "\\") {
      index += 2;
      continue;
    }

    if (character === quote) {
      return source
        .slice(start, index)
        .replace(/\s+/g, " ")
        .trim();
    }

    index += 1;
  }

  return null;
}

function collectLineStarts(source: string): number[] {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function lineNumberAt(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const lineStart = lineStarts[middle];

    if (lineStart !== undefined && lineStart <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function maskNonCode(source: string): string {
  const characters = source.split("");
  let state:
    | "code"
    | "single"
    | "double"
    | "template"
    | "line-comment"
    | "block-comment" = "code";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (character === "/" && next === "/") {
        characters[index] = " ";
        characters[index + 1] = " ";
        state = "line-comment";
        index += 1;
        continue;
      }

      if (character === "/" && next === "*") {
        characters[index] = " ";
        characters[index + 1] = " ";
        state = "block-comment";
        index += 1;
        continue;
      }

      if (character === "'") {
        characters[index] = " ";
        state = "single";
        continue;
      }

      if (character === '"') {
        characters[index] = " ";
        state = "double";
        continue;
      }

      if (character === "`") {
        characters[index] = " ";
        state = "template";
      }

      continue;
    }

    if (character === "\n") {
      if (state === "line-comment") {
        state = "code";
      }

      continue;
    }

    characters[index] = " ";

    if (state === "block-comment" && character === "*" && next === "/") {
      characters[index + 1] = " ";
      state = "code";
      index += 1;
      continue;
    }

    if (
      (state === "single" || state === "double" || state === "template") &&
      character === "\\"
    ) {
      if (index + 1 < characters.length) {
        characters[index + 1] = " ";
      }

      index += 1;
      continue;
    }

    if (
      (state === "single" && character === "'") ||
      (state === "double" && character === '"') ||
      (state === "template" && character === "`")
    ) {
      state = "code";
    }
  }

  return characters.join("");
}

export function isVitestScope(
  scope: RuleScope,
): scope is SupportedScope {
  return scope.startsWith("vitest:");
}

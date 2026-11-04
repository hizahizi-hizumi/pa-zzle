const compiledPatterns = new Map<string, RegExp>();

/**
 * リポジトリ直下からの相対パスが、glob 形式のパターンに一致するかを返す。
 * `**` は 0 個以上のディレクトリ、`*` はディレクトリ区切りを含まない 0 文字以上に一致する。
 */
export function matchesPathPattern(filePath: string, pattern: string): boolean {
  let compiled = compiledPatterns.get(pattern);
  if (compiled === undefined) {
    compiled = compilePathPattern(pattern);
    compiledPatterns.set(pattern, compiled);
  }
  return compiled.test(filePath);
}

export function matchesAnyPathPattern(
  filePath: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) => matchesPathPattern(filePath, pattern));
}

function compilePathPattern(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((segment, index, segments) => {
      const isLast = index === segments.length - 1;
      if (segment === "**") {
        return isLast ? ".*" : "(?:[^/]+/)*";
      }
      const segmentSource = segment.split("*").map(escapeRegExp).join("[^/]*");
      return isLast ? segmentSource : `${segmentSource}/`;
    })
    .join("");
  return new RegExp(`^${source}$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

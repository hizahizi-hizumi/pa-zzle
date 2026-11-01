import {
  assertNonogramGridSize,
  getNonogramLineCellIndices,
  type NonogramGridSize,
  type NonogramLine,
} from "@/games/nonogram/puzzle/board";

/** 図柄。問題の解で、`black` は各マスが黒かを行優先で並べる。 */
export type NonogramPattern = NonogramGridSize & {
  black: readonly boolean[];
};

const blackByNotation = {
  "#": true,
  ".": false,
} as const satisfies Record<string, boolean>;

type NonogramPatternNotation = keyof typeof blackByNotation;

function isNonogramPatternNotation(
  value: string,
): value is NonogramPatternNotation {
  return Object.hasOwn(blackByNotation, value);
}

export function assertNonogramPattern(pattern: NonogramPattern): void {
  assertNonogramGridSize(pattern);
  if (pattern.black.length !== pattern.width * pattern.height) {
    throw new RangeError("Nonogram pattern cells must fill the board");
  }
}

/**
 * 1行を1文字列とした記法から図柄を作る。`#` が黒、`.` が白。
 * テストや固定の図柄を読みやすく書くための記法。
 */
export function parseNonogramPattern(rows: readonly string[]): NonogramPattern {
  const width = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== width)) {
    throw new RangeError("Nonogram pattern rows must share a width");
  }

  const black = rows.flatMap(function parseRow(row) {
    return Array.from(row, function parseCell(notation) {
      if (!isNonogramPatternNotation(notation)) {
        throw new RangeError(`Unknown Nonogram pattern notation: ${notation}`);
      }
      return blackByNotation[notation];
    });
  });
  const pattern = { width, height: rows.length, black };
  assertNonogramPattern(pattern);
  return pattern;
}

/** `parseNonogramPattern` と同じ記法で、1行を1文字列にする。 */
export function formatNonogramPattern(pattern: NonogramPattern): string[] {
  return Array.from({ length: pattern.height }, function formatRow(_, row) {
    return pattern.black
      .slice(row * pattern.width, (row + 1) * pattern.width)
      .map((isBlack) => (isBlack ? "#" : "."))
      .join("");
  });
}

export function getNonogramPatternLine(
  pattern: NonogramPattern,
  line: NonogramLine,
): boolean[] {
  return getNonogramLineCellIndices(pattern, line).map(
    (cellIndex) => pattern.black[cellIndex] === true,
  );
}

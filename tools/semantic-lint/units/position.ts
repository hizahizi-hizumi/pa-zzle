import type { SourceRange, Span } from "../domain/model.ts";

/** 文字位置から1始まりの行・列へ変換する。列はUTF-16 code unit単位。 */
export class LineIndex {
  readonly #lineStarts: number[];

  constructor(source: string) {
    this.#lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === "\n") {
        this.#lineStarts.push(index + 1);
      }
    }
  }

  range(span: Span): SourceRange {
    const start = this.position(span.start);
    const end = this.position(span.end);

    return {
      startLine: start.line,
      startColumn: start.column,
      endLine: end.line,
      endColumn: end.column,
    };
  }

  position(offset: number): { line: number; column: number } {
    let low = 0;
    let high = this.#lineStarts.length - 1;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);

      if ((this.#lineStarts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return {
      line: low + 1,
      column: offset - (this.#lineStarts[low] ?? 0) + 1,
    };
  }
}

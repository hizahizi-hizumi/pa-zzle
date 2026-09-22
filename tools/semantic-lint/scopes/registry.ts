import type {
  ScopeId,
  SourceDocument,
  SourceRange,
  Subject,
} from "../domain/model.ts";

export type ScopeExtractor = (document: SourceDocument) => Subject[];

export class ScopeRegistry {
  readonly #extractors = new Map<ScopeId, ScopeExtractor>();

  constructor() {
    this.register("file", extractFileSubject);
  }

  register(scope: ScopeId, extractor: ScopeExtractor): void {
    if (this.#extractors.has(scope)) {
      throw new Error(`scopeが重複しています: ${scope}`);
    }

    this.#extractors.set(scope, extractor);
  }

  has(scope: ScopeId): boolean {
    return this.#extractors.has(scope);
  }

  extract(scope: ScopeId, document: SourceDocument): Subject[] {
    const extractor = this.#extractors.get(scope);

    if (!extractor) {
      throw new Error(`未登録のscopeです: ${scope}`);
    }

    return extractor(document);
  }

  ids(): string[] {
    return [...this.#extractors.keys()].sort();
  }
}

function extractFileSubject(document: SourceDocument): Subject[] {
  return [
    {
      id: subjectId("file", document.path, 0),
      scope: "file",
      path: document.path,
      range: fullRange(document.source),
      symbol: document.path,
      source: document.source,
    },
  ];
}

function fullRange(source: string): SourceRange {
  const lines = source.split("\n");

  return {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines.at(-1)?.length ?? 0) + 1,
  };
}

export function subjectId(scope: ScopeId, path: string, index: number): string {
  return `${scope}:${path}:${index}`;
}

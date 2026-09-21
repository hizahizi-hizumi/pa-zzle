import type {
  ScopeId,
  SourceDocument,
  SourceRange,
  Subject,
  TargetKind,
} from "../domain/model.ts";

export type ScopeExtractor = (
  document: SourceDocument,
  target: TargetKind,
) => Subject[];

type RegisteredScope = {
  supportedTargets: ReadonlySet<TargetKind>;
  extract: ScopeExtractor;
};

export class ScopeRegistry {
  readonly #scopes = new Map<ScopeId, RegisteredScope>();

  constructor() {
    this.register("file", ["self"], extractFileSubjects);
  }

  register(
    scope: ScopeId,
    supportedTargets: readonly TargetKind[],
    extractor: ScopeExtractor,
  ): void {
    if (this.#scopes.has(scope)) {
      throw new Error(`scopeが重複しています: ${scope}`);
    }

    this.#scopes.set(scope, {
      supportedTargets: new Set(supportedTargets),
      extract: extractor,
    });
  }

  has(scope: ScopeId): boolean {
    return this.#scopes.has(scope);
  }

  supports(scope: ScopeId, target: TargetKind): boolean {
    return this.#scopes.get(scope)?.supportedTargets.has(target) ?? false;
  }

  extract(
    scope: ScopeId,
    target: TargetKind,
    document: SourceDocument,
  ): Subject[] {
    const registered = this.#scopes.get(scope);

    if (!registered) {
      throw new Error(`未登録のcontextです: ${scope}`);
    }

    if (!registered.supportedTargets.has(target)) {
      throw new Error(`context ${scope} はtarget ${target}をサポートしていません。`);
    }

    return registered.extract(document, target);
  }

  ids(): string[] {
    return [...this.#scopes.keys()].sort();
  }
}

function extractFileSubjects(
  document: SourceDocument,
  target: TargetKind,
): Subject[] {
  if (target !== "self") {
    return [];
  }

  const range = fullRange(document.source);

  return [
    {
      id: subjectId("file", "self", document.path, 0),
      contextScope: "file",
      targetKind: "self",
      path: document.path,
      range,
      symbol: document.path,
      source: document.source,
      contextRange: range,
      contextSymbol: document.path,
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

export function subjectId(
  scope: ScopeId,
  target: TargetKind,
  path: string,
  contextIndex: number,
  targetIndex?: number,
): string {
  const suffix = targetIndex === undefined ? "" : `:${targetIndex}`;
  return `${scope}:${target}:${path}:${contextIndex}${suffix}`;
}

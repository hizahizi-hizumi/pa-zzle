import type { SourceDocument } from "../domain/model.ts";
import { buildOutline } from "./context.ts";
import { BUILTIN_UNITS } from "./definitions.ts";
import {
  ContextStore,
  DEFAULT_UNIT_OPTIONS,
  type Unit,
  type UnitDefinition,
  type UnitDocument,
  type UnitExtractionOptions,
} from "./model.ts";
import { parseDocument } from "./syntax.ts";

/** unit語彙の登録簿。語彙を増やすときはUnitDefinitionを登録する。 */
export class UnitRegistry {
  readonly #definitions = new Map<string, UnitDefinition>();

  register(definition: UnitDefinition): void {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`unitが重複しています: ${definition.id}`);
    }

    this.#definitions.set(definition.id, definition);
  }

  has(kind: string): boolean {
    return this.#definitions.has(kind);
  }

  ids(): string[] {
    return [...this.#definitions.keys()].sort();
  }

  description(kind: string): string {
    return this.#definition(kind).description;
  }

  /** 1文書から指定種類の単位をすべて抽出し、文脈を共有した形で返す。 */
  build(
    document: SourceDocument,
    kinds: readonly string[],
    options: UnitExtractionOptions = DEFAULT_UNIT_OPTIONS,
  ): UnitDocument {
    const parsed = parseDocument(document);
    const contexts = new ContextStore();
    const units: Unit[] = [];

    for (const kind of [...new Set(kinds)].sort()) {
      const built = this.#definition(kind).build(parsed, options, contexts);
      const ids = built.map((_, index) => `${kind}:${document.path}:${index}`);

      built.forEach((unit, index) => {
        const { parentIndex, ...rest } = unit;
        const parentId =
          parentIndex === undefined ? undefined : ids[parentIndex];

        units.push({
          ...rest,
          id: ids[index] ?? `${kind}:${document.path}:${index}`,
          kind,
          path: document.path,
          ...(parentId === undefined ? {} : { parentId }),
        });
      });
    }

    return {
      path: document.path,
      source: document.source,
      outline: buildOutline(parsed),
      units,
      contexts: contexts.values(),
    };
  }

  #definition(kind: string): UnitDefinition {
    const definition = this.#definitions.get(kind);

    if (!definition) {
      throw new Error(`未登録のunitです: ${kind}`);
    }

    return definition;
  }
}

export function createDefaultUnitRegistry(): UnitRegistry {
  const registry = new UnitRegistry();

  for (const definition of BUILTIN_UNITS) {
    registry.register(definition);
  }

  return registry;
}

import { dirname, resolve } from "node:path";
import {
  Language,
  type Node,
  Parser,
  Query,
  type QueryMatch,
} from "web-tree-sitter";

import type { SourceDocument } from "../domain/model.ts";
import {
  DEFAULT_CATALOG_DIR,
  type LanguageDefinition,
  loadUnitCatalog,
  type UnitCatalog,
  type UnitQueryDefinition,
} from "./catalog.ts";

/** sourceの位置。JavaScript文字列のindex（UTF-16 code unit）で表す。 */
export type Span = {
  start: number;
  end: number;
};

export type ExtractedUnit = Span & {
  unit: string;
  symbol?: string;
  /** unitを直接囲むscope（言語定義の `scopes` のnode）。file直下ならfile全体。 */
  scope: Span;
};

let parserInitialization: Promise<void> | undefined;

/**
 * カタログのtree-sitter queryでsourceからunitを抽出する。
 * 言語・フレームワークごとの差はカタログのデータだけで表し、ここでは分岐しない。
 */
export class UnitExtractor {
  readonly catalog: UnitCatalog;
  readonly #parsers: Map<string, Parser>;
  readonly #queries: Map<UnitQueryDefinition, Query>;

  private constructor(
    catalog: UnitCatalog,
    parsers: Map<string, Parser>,
    queries: Map<UnitQueryDefinition, Query>,
  ) {
    this.catalog = catalog;
    this.#parsers = parsers;
    this.#queries = queries;
  }

  /** 全言語の文法を読み込み、全queryをcompileする。カタログの誤りはここで失敗する。 */
  static async create(catalog?: UnitCatalog): Promise<UnitExtractor> {
    const resolvedCatalog = catalog ?? (await loadUnitCatalog());
    parserInitialization ??= Parser.init();
    await parserInitialization;

    const languages = new Map<string, Language>();
    const parsers = new Map<string, Parser>();

    for (const definition of resolvedCatalog.languages.values()) {
      const language = await Language.load(grammarPath(definition));
      const parser = new Parser();
      parser.setLanguage(language);
      languages.set(definition.id, language);
      parsers.set(definition.id, parser);
    }

    const queries = new Map<UnitQueryDefinition, Query>();

    for (const definition of resolvedCatalog.definitions) {
      const language = languages.get(definition.language);

      if (!language) {
        throw new Error(`未知の言語です: ${definition.language}`);
      }

      try {
        queries.set(definition, new Query(language, definition.query));
      } catch (error) {
        throw new Error(
          `unit queryをcompileできません: ${definition.origin} ${definition.unit} (${definition.language}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return new UnitExtractor(resolvedCatalog, parsers, queries);
  }

  /** 指定したunitをsourceの出現順に抽出する。言語に定義がないunitは空。 */
  extract(
    document: SourceDocument,
    units: readonly string[],
  ): Map<string, ExtractedUnit[]> {
    const result = new Map<string, ExtractedUnit[]>();
    const language = this.catalog.languageFor(document.path);
    const whole = { start: 0, end: document.source.length };
    const syntaxUnits: Array<{ unit: string; definition: UnitQueryDefinition }> =
      [];

    for (const unit of units) {
      if (this.catalog.unit(unit).level === "file") {
        result.set(unit, [
          { unit, ...whole, symbol: document.path, scope: whole },
        ]);
        continue;
      }

      const definition = language
        ? this.catalog.definitionFor(unit, language.id)
        : undefined;

      if (definition) {
        syntaxUnits.push({ unit, definition });
      } else {
        result.set(unit, []);
      }
    }

    if (syntaxUnits.length === 0 || !language) {
      return result;
    }

    const parser = this.#parsers.get(language.id);
    const tree = parser?.parse(document.source);

    if (!tree) {
      throw new Error(`構文解析に失敗しました: ${document.path}`);
    }

    try {
      for (const { unit, definition } of syntaxUnits) {
        const query = this.#queries.get(definition);

        if (!query) {
          throw new Error(`unit queryがありません: ${unit}`);
        }

        result.set(
          unit,
          collectUnits({
            unit,
            definition,
            language,
            matches: query.matches(tree.rootNode),
            whole,
          }),
        );
      }
    } finally {
      tree.delete();
    }

    return result;
  }
}

function collectUnits(options: {
  unit: string;
  definition: UnitQueryDefinition;
  language: LanguageDefinition;
  matches: QueryMatch[];
  whole: Span;
}): ExtractedUnit[] {
  const { unit, definition, language, matches, whole } = options;
  const bySpan = new Map<string, ExtractedUnit>();
  const scopeTypes = new Set(language.scopes);

  for (const match of matches) {
    const node = match.captures.find((capture) => capture.name === "unit")?.node;

    if (!node) {
      continue;
    }

    if (
      definition.contains.length > 0 &&
      node.descendantsOfType(definition.contains).length === 0
    ) {
      continue;
    }

    const key = `${node.startIndex}:${node.endIndex}`;
    const symbol = renderSymbol(definition.symbol, match);
    const existing = bySpan.get(key);

    // 同じnodeに複数のpatternが一致したときは、symbolを決められた一致を優先する。
    if (existing && (existing.symbol !== undefined || symbol === undefined)) {
      continue;
    }

    bySpan.set(key, {
      unit,
      start: node.startIndex,
      end: node.endIndex,
      ...(symbol === undefined ? {} : { symbol }),
      scope: enclosingScope(node, scopeTypes) ?? whole,
    });
  }

  return [...bySpan.values()].sort(
    (left, right) => left.start - right.start || right.end - left.end,
  );
}

function enclosingScope(node: Node, scopeTypes: Set<string>): Span | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (scopeTypes.has(current.type)) {
      return { start: current.startIndex, end: current.endIndex };
    }
  }

  return undefined;
}

/**
 * `{capture}` をcapture nodeの値で置き換える。文字列リテラルは値をJSON文字列にする。
 * captureが一致していなければsymbolなしにする。
 */
function renderSymbol(
  template: string | undefined,
  match: QueryMatch,
): string | undefined {
  if (template === undefined) {
    return undefined;
  }

  let missing = false;
  const symbol = template.replace(/\{([a-zA-Z_][\w.-]*)\}/g, (_, name: string) => {
    const node = match.captures.find((capture) => capture.name === name)?.node;

    if (!node) {
      missing = true;
      return "";
    }

    const literal = decodeQuotedLiteral(node.text);

    return literal === undefined ? node.text : JSON.stringify(literal);
  });

  return missing ? undefined : symbol;
}

/** 引用符で囲まれたリテラルなら、backslash escapeを解いた値を返す。 */
export function decodeQuotedLiteral(text: string): string | undefined {
  const quote = text[0];

  if (
    text.length < 2 ||
    (quote !== '"' && quote !== "'" && quote !== "`") ||
    text.at(-1) !== quote
  ) {
    return undefined;
  }

  return text
    .slice(1, -1)
    .replace(
      /\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r\n|[\s\S])/g,
      (whole, escape: string, codePoint?: string, unicode?: string, hex?: string) => {
        const code = codePoint ?? unicode ?? hex;

        if (code !== undefined) {
          return String.fromCodePoint(Number.parseInt(code, 16));
        }

        switch (escape) {
          case "n":
            return "\n";
          case "r":
            return "\r";
          case "t":
            return "\t";
          case "b":
            return "\b";
          case "f":
            return "\f";
          case "v":
            return "\v";
          case "0":
            return "\0";
          case "\n":
          case "\r\n":
          case " ":
          case " ":
            return "";
          default:
            return whole.slice(1);
        }
      },
    );
}

function grammarPath(language: LanguageDefinition): string {
  const packageJson = Bun.resolveSync(
    `${language.grammar.package}/package.json`,
    DEFAULT_CATALOG_DIR,
  );

  return resolve(dirname(packageJson), language.grammar.wasm);
}

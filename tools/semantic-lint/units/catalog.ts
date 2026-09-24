import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { YAML } from "bun";

/** ツール同梱のunitカタログ。rule作者は編集しない。 */
export const DEFAULT_CATALOG_DIR = fileURLToPath(
  new URL("../catalog/", import.meta.url),
);

export const UNIT_LEVELS = ["file", "syntax", "framework"] as const;
export const CONTEXT_SCOPES = ["outer", "inner", "file"] as const;

export type UnitLevel = (typeof UNIT_LEVELS)[number];
export type ContextScope = (typeof CONTEXT_SCOPES)[number];

/** 判定時にunitの文脈として扱う他のunit。 */
export type UnitContextDeclaration = {
  unit: string;
  scope: ContextScope;
};

export type UnitVocabularyEntry = {
  name: string;
  level: UnitLevel;
  description: string;
  context: UnitContextDeclaration[];
};

export type LanguageDefinition = {
  id: string;
  extensions: string[];
  grammar: {
    package: string;
    wasm: string;
  };
  scopes: string[];
  marker: string;
};

/** 1言語で1unitを抽出するtree-sitter query。 */
export type UnitQueryDefinition = {
  unit: string;
  language: string;
  /** `syntax:<name>` または `framework:<name>`。 */
  origin: string;
  query: string;
  symbol?: string;
  contains: string[];
};

export class UnitCatalog {
  readonly units: ReadonlyMap<string, UnitVocabularyEntry>;
  readonly languages: ReadonlyMap<string, LanguageDefinition>;
  readonly definitions: readonly UnitQueryDefinition[];
  readonly #languageByExtension: Map<string, LanguageDefinition>;
  readonly #definitions: Map<string, UnitQueryDefinition>;

  constructor(options: {
    units: UnitVocabularyEntry[];
    languages: LanguageDefinition[];
    definitions: UnitQueryDefinition[];
  }) {
    this.units = new Map(options.units.map((unit) => [unit.name, unit]));
    this.languages = new Map(
      options.languages.map((language) => [language.id, language]),
    );
    this.definitions = options.definitions;
    this.#languageByExtension = new Map();
    this.#definitions = new Map();

    for (const language of options.languages) {
      for (const extension of language.extensions) {
        const existing = this.#languageByExtension.get(extension);

        if (existing) {
          throw new Error(
            `拡張子 ${extension} が複数の言語に割り当てられています: ${existing.id}, ${language.id}`,
          );
        }

        this.#languageByExtension.set(extension, language);
      }
    }

    for (const unit of options.units) {
      for (const context of unit.context) {
        if (!this.units.has(context.unit)) {
          throw new Error(
            `unit ${unit.name} のcontextが未知のunitを参照しています: ${context.unit}`,
          );
        }
      }
    }

    for (const definition of options.definitions) {
      const unit = this.units.get(definition.unit);

      if (!unit) {
        throw new Error(
          `${definition.origin} が語彙にないunitを定義しています: ${definition.unit}`,
        );
      }

      const expectedLevel = definition.origin.startsWith("syntax:")
        ? "syntax"
        : "framework";

      if (unit.level !== expectedLevel) {
        throw new Error(
          `${definition.origin} は level: ${unit.level} のunitを定義できません: ${definition.unit}`,
        );
      }

      if (!this.languages.has(definition.language)) {
        throw new Error(
          `${definition.origin} が未知の言語を参照しています: ${definition.language}`,
        );
      }

      const key = definitionKey(definition.unit, definition.language);
      const existing = this.#definitions.get(key);

      if (existing) {
        throw new Error(
          `unit ${definition.unit} の ${definition.language} 向け定義が重複しています: ${existing.origin}, ${definition.origin}`,
        );
      }

      this.#definitions.set(key, definition);
    }
  }

  has(unit: string): boolean {
    return this.units.has(unit);
  }

  unit(name: string): UnitVocabularyEntry {
    const unit = this.units.get(name);

    if (!unit) {
      throw new Error(`未知のunitです: ${name}`);
    }

    return unit;
  }

  /** 拡張子からファイルの言語を決める。対応していなければundefined。 */
  languageFor(path: string): LanguageDefinition | undefined {
    return this.#languageByExtension.get(extname(path).toLowerCase());
  }

  definitionFor(
    unit: string,
    language: string,
  ): UnitQueryDefinition | undefined {
    return this.#definitions.get(definitionKey(unit, language));
  }

  /** unitを抽出できる言語。file unitは全言語。 */
  languagesFor(unit: string): string[] {
    if (this.unit(unit).level === "file") {
      return [...this.languages.keys()];
    }

    return this.definitions
      .filter((definition) => definition.unit === unit)
      .map((definition) => definition.language);
  }
}

export async function loadUnitCatalog(
  directory = DEFAULT_CATALOG_DIR,
): Promise<UnitCatalog> {
  const units = compileVocabulary(
    await readYaml(resolve(directory, "units.yaml")),
    resolve(directory, "units.yaml"),
  );
  const languages = compileLanguages(
    await readYaml(resolve(directory, "languages.yaml")),
    resolve(directory, "languages.yaml"),
  );
  const definitions: UnitQueryDefinition[] = [];

  for (const subdirectory of ["syntax", "frameworks"]) {
    for (const path of await listYamlFiles(resolve(directory, subdirectory))) {
      definitions.push(...compileQueryFile(await readYaml(path), path));
    }
  }

  return new UnitCatalog({ units, languages, definitions });
}

export function compileVocabulary(
  value: unknown,
  origin: string,
): UnitVocabularyEntry[] {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.units)) {
    throw new Error(`unit語彙が不正です: ${origin}`);
  }

  const entries = Object.entries(value.units).map(([name, entry]) => {
    if (
      !isUnitName(name) ||
      !isRecord(entry) ||
      !isUnitLevel(entry.level) ||
      typeof entry.description !== "string"
    ) {
      throw new Error(`unit定義が不正です: ${origin} units.${name}`);
    }

    const context = entry.context ?? [];

    if (!Array.isArray(context)) {
      throw new Error(`unit contextが不正です: ${origin} units.${name}`);
    }

    return {
      name,
      level: entry.level,
      description: entry.description,
      context: context.map((item, index) => {
        if (
          !isRecord(item) ||
          typeof item.unit !== "string" ||
          !isContextScope(item.scope)
        ) {
          throw new Error(
            `unit contextが不正です: ${origin} units.${name}.context[${index}]`,
          );
        }

        return { unit: item.unit, scope: item.scope };
      }),
    };
  });

  const fileUnits = entries.filter((entry) => entry.level === "file");

  if (fileUnits.length !== 1 || fileUnits[0]?.name !== "file") {
    throw new Error(`level: file のunitは file 1つだけにしてください: ${origin}`);
  }

  return entries;
}

export function compileLanguages(
  value: unknown,
  origin: string,
): LanguageDefinition[] {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.languages)) {
    throw new Error(`言語定義が不正です: ${origin}`);
  }

  return Object.entries(value.languages).map(([id, entry]) => {
    if (
      !isUnitName(id) ||
      !isRecord(entry) ||
      !isStringArray(entry.extensions) ||
      entry.extensions.length === 0 ||
      !entry.extensions.every((extension) => /^\.[a-z0-9]+$/.test(extension)) ||
      !isRecord(entry.grammar) ||
      typeof entry.grammar.package !== "string" ||
      typeof entry.grammar.wasm !== "string" ||
      !isStringArray(entry.scopes) ||
      typeof entry.marker !== "string" ||
      !entry.marker.includes("{ref}")
    ) {
      throw new Error(`言語定義が不正です: ${origin} languages.${id}`);
    }

    return {
      id,
      extensions: entry.extensions,
      grammar: {
        package: entry.grammar.package,
        wasm: entry.grammar.wasm,
      },
      scopes: entry.scopes,
      marker: entry.marker,
    };
  });
}

export function compileQueryFile(
  value: unknown,
  origin: string,
): UnitQueryDefinition[] {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.kind !== "syntax" && value.kind !== "framework") ||
    !isUnitName(value.name) ||
    !Array.isArray(value.definitions) ||
    value.definitions.length === 0
  ) {
    throw new Error(`unit query定義が不正です: ${origin}`);
  }

  const source = `${value.kind}:${value.name}`;

  return value.definitions.flatMap((group, groupIndex) => {
    const location = `${origin} definitions[${groupIndex}]`;

    if (
      !isRecord(group) ||
      !isStringArray(group.languages) ||
      group.languages.length === 0 ||
      !isRecord(group.units)
    ) {
      throw new Error(`unit query定義が不正です: ${location}`);
    }

    const languages = group.languages;

    return Object.entries(group.units).flatMap(([unit, entry]) => {
      if (
        !isRecord(entry) ||
        typeof entry.query !== "string" ||
        entry.query.trim().length === 0 ||
        (entry.symbol !== undefined && typeof entry.symbol !== "string") ||
        (entry.contains !== undefined && !isStringArray(entry.contains))
      ) {
        throw new Error(`unit queryが不正です: ${location} units.${unit}`);
      }

      if (!/@unit\b/.test(entry.query)) {
        throw new Error(
          `unit queryに @unit captureがありません: ${location} units.${unit}`,
        );
      }

      const query = entry.query;
      const symbol = entry.symbol;
      const contains = entry.contains ?? [];

      return languages.map((language) => ({
        unit,
        language,
        origin: source,
        query,
        ...(symbol === undefined ? {} : { symbol }),
        contains,
      }));
    });
  });
}

function definitionKey(unit: string, language: string): string {
  return `${unit}\0${language}`;
}

async function readYaml(path: string): Promise<unknown> {
  return YAML.parse(await Bun.file(path).text());
}

async function listYamlFiles(directory: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")),
    )
    .map((entry) => resolve(directory, entry.name))
    .sort();
}

function isUnitName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]*$/.test(value);
}

function isUnitLevel(value: unknown): value is UnitLevel {
  return typeof value === "string" && UNIT_LEVELS.includes(value as UnitLevel);
}

function isContextScope(value: unknown): value is ContextScope {
  return (
    typeof value === "string" && CONTEXT_SCOPES.includes(value as ContextScope)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

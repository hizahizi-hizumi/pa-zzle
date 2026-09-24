import type { SourceDocument } from "../domain/model.ts";
import type { LineSpan, ParsedDocument } from "./syntax.ts";

/**
 * 入れ子の関数をどう単位化するか。
 * - fold: 一定行数未満の関数は単位にせず、外側の単位の本文として扱う。
 * - all: 構文上の関数をすべて単位にする。
 * どちらも親子の重複は位置特定後のrange dedupeで解消する。
 */
export const NESTING_STRATEGIES = ["fold", "all"] as const;
export type NestingStrategy = (typeof NESTING_STRATEGIES)[number];

/**
 * 単位に添える文脈。
 * - skeleton: import・トップレベル宣言の先頭行と、外側の単位を入れ子関数の本文を畳んで渡す。
 * - file: 比較実験用。ファイル全文を渡す。
 */
export const CONTEXT_MODES = ["skeleton", "file"] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];

export type UnitExtractionOptions = {
  nesting: NestingStrategy;
  contextMode: ContextMode;
  /** foldで単位にする関数の最小行数。 */
  minFunctionLines: number;
  /** file unitを1単位にする最大行数。超えたらトップレベル文の境界で分割する。 */
  maxFileLines: number;
  /** 単位が構文上どこにあるか (囲む関数・引数として渡される呼び出し) を質問に添える。 */
  syntacticPosition: boolean;
};

export const DEFAULT_UNIT_OPTIONS: UnitExtractionOptions = {
  nesting: "fold",
  contextMode: "skeleton",
  minFunctionLines: 3,
  maxFileLines: 400,
  syntacticPosition: false,
};

/** 判定単位。rule非依存に構文だけで抽出する。 */
export type Unit = {
  id: string;
  kind: string;
  path: string;
  span: LineSpan;
  /** 人間向けの目印。先頭行を短くしたもの。 */
  symbol: string;
  /** 同じ種類の単位で最も近い外側の単位。 */
  parentId?: string;
  /** 行番号付きの単位本文。 */
  source: string;
  /** 違反単位の中で選ばれた行を展開する先の文。空なら単位自体を指摘範囲にする。 */
  locateTargets: LineSpan[];
  /** state.contextsのid。外側から内側の順。 */
  contextIds: string[];
  /** 構文上の位置の説明。 */
  position?: string;
};

export type UnitContext = {
  id: string;
  description: string;
  source: string;
};

export type UnitDocument = {
  path: string;
  source: string;
  /** import全文とトップレベル文の先頭行。 */
  outline: string;
  units: Unit[];
  contexts: UnitContext[];
};

export type UnitDefinition = {
  id: string;
  /** providerへ単位の種類を説明する文。 */
  description: string;
  /** 抽出器 + 文脈構築。 */
  build(
    parsed: ParsedDocument,
    options: UnitExtractionOptions,
    contexts: ContextStore,
  ): BuiltUnit[];
};

export type BuiltUnit = Omit<Unit, "id" | "kind" | "path" | "parentId"> & {
  /** 同じbuild結果内の外側の単位のindex。 */
  parentIndex?: number;
};

/** 同じ文脈を複数の単位で共有するための登録簿。 */
export class ContextStore {
  readonly #byKey = new Map<string, UnitContext>();

  add(key: string, description: string, source: () => string): string {
    const existing = this.#byKey.get(key);

    if (existing) {
      return existing.id;
    }

    const id = "c" + this.#byKey.size;
    this.#byKey.set(key, { id, description, source: source() });
    return id;
  }

  values(): UnitContext[] {
    return [...this.#byKey.values()];
  }
}

export type { SourceDocument };

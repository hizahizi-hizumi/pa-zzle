import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  DECISIONS,
  type Decision,
  type DecisionResult,
  type ProviderIdentity,
  type ProviderRequestIdentity,
} from "../domain/model.ts";

/** repository root基準の判定キャッシュの保存先。 */
export const DECISION_CACHE_PATH = ".semantic-lint/.cache/decisions.jsonl";

/** key構成や保存形式を変えたときに更新する。 */
const CACHE_FORMAT_VERSION = 4;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_ENTRIES = 50_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * 1判定の答えを決める入力。
 * unitの文脈は、unit本文・祖先・カタログのcontext宣言が指すunit・fileの骨格を並べたもので、
 * 同じfileの無関係なunitの本文は含めない（`unitContextView`）。
 * `parts` は違反箇所の候補のunit内の位置で、回答のpart確率の並びを決める。
 * threshold / severity / 行番号は判定後に使う値なので含めない。
 */
export type DecisionCacheKeyInput = {
  provider: ProviderRequestIdentity;
  unit: string;
  instruction: string;
  path: string;
  context: string;
  parts: Array<[number, number]>;
};

export function decisionCacheKey(input: DecisionCacheKeyInput): string {
  const { provider, unit, instruction, path, context, parts } = input;
  const hasher = new Bun.CryptoHasher("sha256");

  hasher.update(
    JSON.stringify([
      CACHE_FORMAT_VERSION,
      [provider.kind, provider.model, provider.requestFormat],
      [unit, instruction],
      [path, context, parts],
    ]),
  );

  return hasher.digest("hex");
}

/** threshold適用前のprovider判定。 */
export type CachedDecision = {
  result: DecisionResult;
  provider: ProviderIdentity;
};

export interface DecisionCache {
  get(key: string): CachedDecision | undefined;
  put(key: string, value: CachedDecision): Promise<void>;
}

type StoredEntry = CachedDecision & {
  key: string;
  createdAt: number;
  usedAt: number;
};

export type DecisionCacheFileStatus = {
  path: string;
  exists: boolean;
  bytes: number;
  entries: number;
  invalidLines: number;
  oldestUsedAt?: Date;
  newestUsedAt?: Date;
};

/**
 * JSON Linesで保存する判定キャッシュ。
 *
 * 新しい判定はprovider応答ごとに追記するため、途中で失敗した実行の判定も残る。
 * 実行完了時の `compact` で重複を畳み、長く使われていないentryを削除する。
 * 読めない行は無視し、該当判定はmissとして扱う。
 */
export class FileDecisionCache implements DecisionCache {
  readonly path: string;
  readonly #entries: Map<string, StoredEntry>;
  readonly #now: () => number;
  #writeQueue: Promise<void> = Promise.resolve();
  #writeError: unknown;

  private constructor(
    path: string,
    entries: Map<string, StoredEntry>,
    now: () => number,
  ) {
    this.path = path;
    this.#entries = entries;
    this.#now = now;
  }

  static async open(
    path: string,
    options: { now?: () => number } = {},
  ): Promise<FileDecisionCache> {
    const { entries } = await readEntries(path);

    return new FileDecisionCache(path, entries, options.now ?? Date.now);
  }

  get(key: string): CachedDecision | undefined {
    const entry = this.#entries.get(key);

    if (!entry) {
      return undefined;
    }

    entry.usedAt = this.#now();

    return { result: entry.result, provider: entry.provider };
  }

  async put(key: string, value: CachedDecision): Promise<void> {
    const now = this.#now();
    const entry: StoredEntry = {
      key,
      result: value.result,
      provider: value.provider,
      createdAt: now,
      usedAt: now,
    };
    this.#entries.set(key, entry);

    const line = serializeEntry(entry) + "\n";
    const write = this.#writeQueue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await appendFile(this.path, line, "utf8");
    });
    this.#writeQueue = write.catch((error: unknown) => {
      // 保存できなくてもprovider判定そのものは有効なため、lint実行は止めない。
      this.#writeError ??= error;
    });

    await this.#writeQueue;
  }

  /** 追記に失敗した最初のerror。 */
  get writeError(): unknown {
    return this.#writeError;
  }

  /**
   * 利用日時を反映して書き直す。最終利用からretentionDaysを過ぎたentryと、
   * maxEntriesを超えた古いentryを削除する。
   */
  async compact(
    options: { retentionDays?: number; maxEntries?: number } = {},
  ): Promise<{ kept: number; removed: number }> {
    const {
      retentionDays = DEFAULT_RETENTION_DAYS,
      maxEntries = DEFAULT_MAX_ENTRIES,
    } = options;

    await this.#writeQueue;

    if (this.#entries.size === 0 && !(await fileExists(this.path))) {
      return { kept: 0, removed: 0 };
    }

    const cutoff = this.#now() - retentionDays * DAY_MS;
    const kept = [...this.#entries.values()]
      .filter((entry) => entry.usedAt >= cutoff)
      .sort((left, right) => right.usedAt - left.usedAt)
      .slice(0, maxEntries);
    const removed = this.#entries.size - kept.length;
    const temporaryPath = `${this.path}.${process.pid}.tmp`;

    await mkdir(dirname(this.path), { recursive: true });
    await Bun.write(
      temporaryPath,
      kept.map((entry) => serializeEntry(entry) + "\n").join(""),
    );
    await rename(temporaryPath, this.path);

    this.#entries.clear();

    for (const entry of kept) {
      this.#entries.set(entry.key, entry);
    }

    return { kept: kept.length, removed };
  }
}

export function decisionCachePath(projectRoot: string): string {
  return resolve(projectRoot, DECISION_CACHE_PATH);
}

export async function inspectDecisionCacheFile(
  path: string,
): Promise<DecisionCacheFileStatus> {
  if (!(await fileExists(path))) {
    return { path, exists: false, bytes: 0, entries: 0, invalidLines: 0 };
  }

  const { entries, invalidLines } = await readEntries(path);
  const usedAt = [...entries.values()].map((entry) => entry.usedAt);

  return {
    path,
    exists: true,
    bytes: (await stat(path)).size,
    entries: entries.size,
    invalidLines,
    ...(usedAt.length === 0
      ? {}
      : {
          oldestUsedAt: new Date(Math.min(...usedAt)),
          newestUsedAt: new Date(Math.max(...usedAt)),
        }),
  };
}

async function readEntries(path: string): Promise<{
  entries: Map<string, StoredEntry>;
  invalidLines: number;
}> {
  const entries = new Map<string, StoredEntry>();
  let invalidLines = 0;
  let text: string;

  try {
    text = await Bun.file(path).text();
  } catch {
    return { entries, invalidLines };
  }

  for (const line of text.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    const entry = parseEntry(line);

    if (!entry) {
      invalidLines += 1;
      continue;
    }

    const existing = entries.get(entry.key);

    if (existing) {
      entry.createdAt = Math.min(existing.createdAt, entry.createdAt);
      entry.usedAt = Math.max(existing.usedAt, entry.usedAt);
    }

    entries.set(entry.key, entry);
  }

  return { entries, invalidLines };
}

function serializeEntry(entry: StoredEntry): string {
  return JSON.stringify({
    v: CACHE_FORMAT_VERSION,
    key: entry.key,
    createdAt: new Date(entry.createdAt).toISOString(),
    usedAt: new Date(entry.usedAt).toISOString(),
    provider: entry.provider,
    result: entry.result,
  });
}

function parseEntry(line: string): StoredEntry | undefined {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }

  if (
    !isRecord(value) ||
    value.v !== CACHE_FORMAT_VERSION ||
    typeof value.key !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.key) ||
    !isRecord(value.provider) ||
    typeof value.provider.kind !== "string" ||
    typeof value.provider.model !== "string"
  ) {
    return undefined;
  }

  const createdAt = parseTime(value.createdAt);
  const usedAt = parseTime(value.usedAt);
  const result = parseDecisionResult(value.result);

  if (createdAt === undefined || usedAt === undefined || !result) {
    return undefined;
  }

  return {
    key: value.key,
    createdAt,
    usedAt,
    provider: {
      kind: value.provider.kind,
      model: value.provider.model,
    },
    result,
  };
}

function parseDecisionResult(value: unknown): DecisionResult | undefined {
  if (
    !isRecord(value) ||
    !isDecision(value.decision) ||
    !isProbability(value.confidence) ||
    !isRecord(value.probabilities)
  ) {
    return undefined;
  }

  const probabilities: Partial<Record<Decision, number>> = {};

  for (const decision of DECISIONS) {
    const probability = value.probabilities[decision];

    if (!isProbability(probability)) {
      return undefined;
    }

    probabilities[decision] = probability;
  }

  const parts = value.parts;

  if (
    parts !== undefined &&
    (!Array.isArray(parts) || !parts.every((part) => isProbability(part)))
  ) {
    return undefined;
  }

  return {
    decision: value.decision,
    confidence: value.confidence,
    probabilities: probabilities as Record<Decision, number>,
    ...(parts === undefined ? {} : { parts: parts as number[] }),
  };
}

function parseTime(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const time = Date.parse(value);

  return Number.isNaN(time) ? undefined : time;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && DECISIONS.includes(value as Decision);
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { ChoiceAnswer } from "../providers/choice.ts";

/**
 * 判定キャッシュのkey素材。thresholdは判定後に適用するため含めない。
 * 対象テキストと文脈は行番号付きで渡すため、行位置が変わればkeyも変わる。
 */
export type DecisionCacheKeyInput = {
  stage: "judge" | "locate";
  model: string;
  rule: {
    instruction: string;
    outcomes: Record<string, string>;
  };
  unit: string;
  contextMode: string;
  target: string;
  context: readonly string[];
  criteria?: Record<string, string>;
};

export function decisionCacheKey(input: DecisionCacheKeyInput): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(
    JSON.stringify([
      1,
      input.stage,
      input.model,
      input.rule.instruction,
      sortedEntries(input.rule.outcomes),
      input.unit,
      input.contextMode,
      input.target,
      input.context,
      input.criteria === undefined ? null : sortedEntries(input.criteria),
    ]),
  );

  return hasher.digest("hex");
}

export interface DecisionCache {
  get(key: string): ChoiceAnswer | undefined;
  set(key: string, answer: ChoiceAnswer): void;
  flush(): Promise<void>;
}

export class MemoryDecisionCache implements DecisionCache {
  readonly #entries = new Map<string, ChoiceAnswer>();

  get(key: string): ChoiceAnswer | undefined {
    return this.#entries.get(key);
  }

  set(key: string, answer: ChoiceAnswer): void {
    this.#entries.set(key, answer);
  }

  async flush(): Promise<void> {}

  entries(): Array<[string, ChoiceAnswer]> {
    return [...this.#entries.entries()];
  }
}

/** 1ファイルのJSONに保存する判定キャッシュ。 */
export class FileDecisionCache implements DecisionCache {
  readonly #path: string;
  readonly #memory: MemoryDecisionCache;
  #dirty = false;

  private constructor(path: string, memory: MemoryDecisionCache) {
    this.#path = path;
    this.#memory = memory;
  }

  static async open(path: string): Promise<FileDecisionCache> {
    const memory = new MemoryDecisionCache();
    const file = Bun.file(path);

    if (await file.exists()) {
      try {
        const value: unknown = await file.json();

        if (typeof value === "object" && value !== null) {
          for (const [key, answer] of Object.entries(value)) {
            memory.set(key, answer as ChoiceAnswer);
          }
        }
      } catch {
        // 壊れたキャッシュは判定をやり直せば復元できるため捨てる。
      }
    }

    return new FileDecisionCache(path, memory);
  }

  get(key: string): ChoiceAnswer | undefined {
    return this.#memory.get(key);
  }

  set(key: string, answer: ChoiceAnswer): void {
    this.#memory.set(key, answer);
    this.#dirty = true;
  }

  async flush(): Promise<void> {
    if (!this.#dirty) {
      return;
    }

    await mkdir(dirname(this.#path), { recursive: true });
    await Bun.write(
      this.#path,
      JSON.stringify(Object.fromEntries(this.#memory.entries())),
    );
    this.#dirty = false;
  }
}

function sortedEntries(record: Record<string, string>): Array<[string, string]> {
  return Object.entries(record).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProviderRequestIdentity } from "../domain/model.ts";
import { decisionResult, sampleRule } from "../testing/fixtures.ts";
import {
  decisionCacheKey,
  FileDecisionCache,
  inspectDecisionCacheFile,
  type DecisionCacheKeyInput,
} from "./decision-cache.ts";

const DAY_MS = 24 * 60 * 60 * 1_000;
const PROVIDER: ProviderRequestIdentity = {
  kind: "typesafe",
  model: "jev-latest",
  requestFormat: "systemone-choice/1",
};

let directory: string;
let cachePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "semantic-lint-cache-"));
  cachePath = join(directory, "nested", "decisions.jsonl");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("decisionCacheKey", () => {
  test("providerへ送る入力が同じならthreshold / severity / titleが違っても同じkeyになる", () => {
    const base = keyInput();
    const rule = sampleRule({
      violationThreshold: 0.5,
      severity: "error",
      title: "other",
    });

    expect(
      decisionCacheKey({ ...base, instruction: rule.instruction, unit: rule.unit }),
    ).toBe(decisionCacheKey(base));
  });

  test.each<[string, (input: DecisionCacheKeyInput) => DecisionCacheKeyInput]>([
    ["provider kind", (input) => ({ ...input, provider: { ...input.provider, kind: "other" } })],
    ["model", (input) => ({ ...input, provider: { ...input.provider, model: "jev-next" } })],
    ["request format", (input) => ({ ...input, provider: { ...input.provider, requestFormat: "systemone-choice/2" } })],
    ["unit", (input) => ({ ...input, unit: "test" })],
    ["instruction", (input) => ({ ...input, instruction: "changed" })],
    ["file path", (input) => ({ ...input, path: "b.test.ts" })],
    ["unit context", (input) => ({ ...input, context: "changed" })],
    ["parts", (input) => ({ ...input, parts: [[0, 8], [9, 16]] })],
  ])("%sが変わるとkeyが変わる", (_name, change) => {
    const base = keyInput();

    expect(decisionCacheKey(change(base))).not.toBe(decisionCacheKey(base));
  });
});

describe("FileDecisionCache", () => {
  test("追記した判定を別のinstanceから読める", async () => {
    const key = decisionCacheKey(keyInput());
    const value = {
      result: { ...decisionResult("violation", 0.9), parts: [0.7, 0.1] },
      provider: { kind: "typesafe", model: "jev-1" },
    };
    const writer = await FileDecisionCache.open(cachePath);
    await writer.put(key, value);

    const reader = await FileDecisionCache.open(cachePath);

    expect(reader.get(key)).toEqual(value);
    expect(reader.get("0".repeat(64))).toBeUndefined();
  });

  test("compactは最終利用から保持期間を過ぎたentryを削除し、参照したentryは残す", async () => {
    let now = Date.parse("2026-01-01T00:00:00Z");
    const clock = () => now;
    const used = decisionCacheKey(keyInput());
    const unused = decisionCacheKey({ ...keyInput(), unit: "test" });
    const value = {
      result: decisionResult("no_violation", 0),
      provider: { kind: "typesafe", model: "jev-1" },
    };
    const first = await FileDecisionCache.open(cachePath, { now: clock });
    await first.put(used, value);
    await first.put(unused, value);
    await first.compact();

    now += 20 * DAY_MS;
    const second = await FileDecisionCache.open(cachePath, { now: clock });
    second.get(used);
    await second.compact({ retentionDays: 30 });

    now += 20 * DAY_MS;
    const third = await FileDecisionCache.open(cachePath, { now: clock });
    const result = await third.compact({ retentionDays: 30 });

    expect(result).toEqual({ kept: 1, removed: 1 });
    expect(third.get(used)).toEqual(value);
    expect(third.get(unused)).toBeUndefined();
  });

  test("compactはmaxEntriesを超えた分を最終利用の古い順に削除する", async () => {
    let now = 0;
    const cache = await FileDecisionCache.open(cachePath, { now: () => now });
    const keys = ["a", "b", "c"].map((unit) =>
      decisionCacheKey({ ...keyInput(), unit }),
    );

    for (const key of keys) {
      now += 1_000;
      await cache.put(key, {
        result: decisionResult("no_violation", 0),
        provider: { kind: "typesafe", model: "jev-1" },
      });
    }

    await cache.compact({ maxEntries: 2, retentionDays: 1 });

    const status = await inspectDecisionCacheFile(cachePath);
    const reopened = await FileDecisionCache.open(cachePath);

    expect(status.entries).toBe(2);
    expect(reopened.get(keys[0] ?? "")).toBeUndefined();
  });

  test("判定の選択肢が現在と異なるentryは読めない行として扱う", async () => {
    const key = decisionCacheKey(keyInput());
    await Bun.write(
      cachePath,
      JSON.stringify({
        key,
        createdAt: "2026-01-01T00:00:00.000Z",
        usedAt: "2026-01-01T00:00:00.000Z",
        provider: { kind: "typesafe", model: "jev-1" },
        result: {
          decision: "compliant",
          confidence: 0.9,
          probabilities: {
            violation: 0.1,
            compliant: 0.9,
            not_applicable: 0,
            insufficient_context: 0,
          },
        },
      }) + "\n",
    );

    const cache = await FileDecisionCache.open(cachePath);

    expect(cache.get(key)).toBeUndefined();
    expect(await inspectDecisionCacheFile(cachePath)).toMatchObject({
      entries: 0,
      invalidLines: 1,
    });
  });

  test("状態確認は未作成・entry数・読めない行を返す", async () => {
    expect(await inspectDecisionCacheFile(cachePath)).toMatchObject({
      exists: false,
      entries: 0,
    });

    const cache = await FileDecisionCache.open(cachePath);
    await cache.put(decisionCacheKey(keyInput()), {
      result: decisionResult("no_violation", 0),
      provider: { kind: "typesafe", model: "jev-1" },
    });
    await Bun.write(
      cachePath,
      (await Bun.file(cachePath).text()) + "{broken\n",
    );

    expect(await inspectDecisionCacheFile(cachePath)).toMatchObject({
      exists: true,
      entries: 1,
      invalidLines: 1,
    });
  });
});

function keyInput(): DecisionCacheKeyInput {
  const rule = sampleRule();

  return {
    provider: PROVIDER,
    unit: rule.unit,
    instruction: rule.instruction,
    path: "a.test.ts",
    context: "const value = 1;\n",
    parts: [[0, 16]],
  };
}

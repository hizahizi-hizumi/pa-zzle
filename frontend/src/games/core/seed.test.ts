import { describe, expect, test } from "vitest";

import { createSeed } from "@/games/core/seed";

describe("createSeed", () => {
  test("32桁の16進数として問題を識別できるseedを生成すること", () => {
    const seed = createSeed();

    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });
});

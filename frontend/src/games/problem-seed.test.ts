import { describe, expect, test } from "vitest";

import { createProblemSeed } from "@/games/problem-seed";

describe("createProblemSeed", () => {
  test("32桁の16進数として問題を識別できるseedを生成すること", () => {
    const seed = createProblemSeed();

    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });
});

import { describe, expect, test } from "bun:test";

import { _private } from "./check.ts";

const { parseCheckOptions } = _private;

describe("check options", () => {
  test("判定cacheは既定で有効にする", () => {
    expect(parseCheckOptions([]).cache).toBe(true);
  });

  test("--no-cacheで判定cacheを無効にする", () => {
    expect(parseCheckOptions(["--no-cache", "frontend"])).toMatchObject({
      cache: false,
      paths: ["frontend"],
    });
  });
});

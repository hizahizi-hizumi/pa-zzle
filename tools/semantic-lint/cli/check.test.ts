import { describe, expect, test } from "bun:test";

import type { RunResult, Severity } from "../domain/model.ts";
import { _private } from "./check.ts";

const { parseCheckOptions, exitCodeForResult } = _private;

function resultWith(severities: Severity[]): RunResult {
  return {
    diagnostics: severities.map((severity) => ({ severity })),
    unknowns: [],
  } as unknown as RunResult;
}

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

  test("--plan-onlyでproviderを呼ばない計画だけを出す", () => {
    expect(parseCheckOptions(["--plan-only"]).planOnly).toBe(true);
  });
});

describe("check exit code", () => {
  test.each<[string, Severity[], string[], number]>([
    ["infoだけなら失敗しない", ["info"], [], 0],
    ["warningだけなら失敗しない", ["warning"], [], 0],
    ["errorがあれば失敗する", ["info", "warning", "error"], [], 1],
    ["--fail-on warningではwarningで失敗する", ["warning"], ["--fail-on", "warning"], 1],
    ["--fail-on warningでもinfoでは失敗しない", ["info"], ["--fail-on", "warning"], 0],
  ])("%s", (_, severities, args, expected) => {
    expect(
      exitCodeForResult(resultWith(severities), parseCheckOptions(args)),
    ).toBe(expected);
  });
});

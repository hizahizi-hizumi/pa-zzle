import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  compileGoldenSet,
  type GoldenSet,
  gitBlobHash,
  resolveGoldenFiles,
} from "./golden.ts";

const encoder = new TextEncoder();

describe("compileGoldenSet", () => {
  test("rule / blob / 期待行範囲を読み込む", () => {
    const golden = compileGoldenSet(
      {
        version: 1,
        rule: "vitest/sample",
        baseCommit: "a".repeat(40),
        files: [
          {
            path: "frontend/a.test.ts",
            blob: "b".repeat(40),
            findings: [{ lines: [3, 5], note: "Arrange" }],
          },
          {
            path: "frontend/clean.test.ts",
            blob: "c".repeat(40),
            findings: [],
          },
        ],
      },
      "golden.yaml",
    );

    expect(golden).toEqual({
      ruleId: "vitest/sample",
      baseCommit: "a".repeat(40),
      origin: "golden.yaml",
      files: [
        {
          path: "frontend/a.test.ts",
          blob: "b".repeat(40),
          findings: [{ startLine: 3, endLine: 5, note: "Arrange" }],
        },
        {
          path: "frontend/clean.test.ts",
          blob: "c".repeat(40),
          findings: [],
        },
      ],
    });
  });

  test("列は両端を含む範囲として読み、終了列は範囲の直後にする", () => {
    const golden = compileGoldenSet(
      {
        version: 1,
        rule: "naming/sample",
        baseCommit: "a".repeat(40),
        files: [
          {
            path: "frontend/a.ts",
            blob: "b".repeat(40),
            findings: [{ lines: [1, 1], columns: [7, 10] }],
          },
        ],
      },
      "golden.yaml",
    );

    expect(golden.files[0]?.findings).toEqual([
      { startLine: 1, endLine: 1, startColumn: 7, endColumn: 11 },
    ]);
  });

  test("開始行が終了行より後の範囲を拒否する", () => {
    expect(() =>
      compileGoldenSet(
        {
          version: 1,
          rule: "vitest/sample",
          baseCommit: "a".repeat(40),
          files: [
            {
              path: "frontend/a.test.ts",
              blob: "b".repeat(40),
              findings: [{ lines: [5, 3] }],
            },
          ],
        },
        "golden.yaml",
      ),
    ).toThrow("行範囲が不正です");
  });

  test("同じpathの重複を拒否する", () => {
    const file = {
      path: "frontend/a.test.ts",
      blob: "b".repeat(40),
      findings: [],
    };

    expect(() =>
      compileGoldenSet(
        {
          version: 1,
          rule: "vitest/sample",
          baseCommit: "a".repeat(40),
          files: [file, file],
        },
        "golden.yaml",
      ),
    ).toThrow("pathが重複しています");
  });
});

describe("gitBlobHash", () => {
  test("git hash-objectと同じblob idを返す", () => {
    const hash = gitBlobHash(encoder.encode("hello\n"));

    expect(hash).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });
});

describe("resolveGoldenFiles", () => {
  test("working treeが変わっていればgoldenのblobを評価に使う", async () => {
    const root = await mkdtemp(join(tmpdir(), "semantic-lint-golden-"));

    try {
      const original = encoder.encode("original\n");
      const changedPath = "changed.test.ts";
      const currentPath = "current.test.ts";
      await writeFile(join(root, changedPath), "edited\n");
      await writeFile(join(root, currentPath), original);
      const golden: GoldenSet = {
        ruleId: "vitest/sample",
        baseCommit: "a".repeat(40),
        origin: "golden.yaml",
        files: [
          { path: changedPath, blob: gitBlobHash(original), findings: [] },
          { path: currentPath, blob: gitBlobHash(original), findings: [] },
          { path: "missing.test.ts", blob: gitBlobHash(original), findings: [] },
        ],
      };
      const requestedBlobs: string[] = [];

      const files = await resolveGoldenFiles(root, golden, async (blob) => {
        requestedBlobs.push(blob);
        return original;
      });

      expect(files.map((file) => [file.path, file.status, file.source])).toEqual([
        [changedPath, "changed", "original\n"],
        [currentPath, "current", "original\n"],
        ["missing.test.ts", "missing", "original\n"],
      ]);
      expect(requestedBlobs).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

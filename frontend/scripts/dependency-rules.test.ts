import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appAreas,
  createDependencyRuleOverrides,
  featureAreas,
  listConcreteGames,
  listUnregisteredSourceAreas,
} from "./dependency-rules";

const frontendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("createDependencyRuleOverrides", () => {
  const biomeConfig = JSON.parse(
    readFileSync(path.join(frontendDirectory, "biome.json"), "utf8"),
  );
  const games = listConcreteGames(path.join(frontendDirectory, "src/games"));

  test("biome.json の overrides が全ゲームから生成した依存規則と一致すること", () => {
    const overrides = createDependencyRuleOverrides(games);

    expect(
      biomeConfig.overrides,
      "bun run generate:dependency-rules で biome.json を更新する",
    ).toEqual(overrides);
  });
});

describe("listUnregisteredSourceAreas", () => {
  const sourceDirectory = path.join(frontendDirectory, "src");
  let scratchDirectory: string;

  beforeEach(() => {
    scratchDirectory = mkdtempSync(path.join(tmpdir(), "pa-zzle-dependency-"));
  });

  afterEach(() => {
    rmSync(scratchDirectory, { recursive: true, force: true });
  });

  test("既存のsrc配下に未登録の責務ディレクトリがないこと", () => {
    const unknown = listUnregisteredSourceAreas(sourceDirectory);

    expect(unknown).toEqual([]);
  });

  test("トップレベルとappとfeaturesとlibに追加された未登録領域を検出すること", () => {
    mkdirSync(path.join(scratchDirectory, "music"), { recursive: true });
    mkdirSync(path.join(scratchDirectory, "app", "audio"), {
      recursive: true,
    });
    mkdirSync(path.join(scratchDirectory, "features", "music"), {
      recursive: true,
    });
    mkdirSync(path.join(scratchDirectory, "lib", "music"), {
      recursive: true,
    });

    const unknown = listUnregisteredSourceAreas(scratchDirectory);

    expect(unknown).toEqual([
      "music",
      "app/audio",
      "features/music",
      "lib/music",
    ]);
  });
});

describe("Biomeの依存制約", () => {
  const biome = path.join(frontendDirectory, "node_modules", ".bin", "biome");
  const cases = [
    ["src/pages/example.tsx", "@/views/PlayRecordsView", true],
    [
      "src/app/navigation/example.ts",
      "@/lib/../app/game-integration/game-catalog",
      false,
    ],
    [
      "src/app/navigation/example.ts",
      "@/features/./settings/SettingsDialog",
      false,
    ],
    [
      "src/app/navigation/example.ts",
      "@/../app/game-integration/game-catalog",
      false,
    ],
    ["src/app/navigation/example.ts", "@/app/game-integration", false],
    [
      "src/app/navigation/example.ts",
      "@/app/game-integration/game-catalog",
      false,
    ],
    ["src/app/game-integration/example.ts", "@/app/navigation", true],
    ["src/app/game-integration/example.ts", "@/app/shell", false],
    [
      "src/app/game-home/example.ts",
      "@/app/game-integration/game-catalog",
      true,
    ],
    ["src/app/shell/example.ts", "@/app/game-integration/game-catalog", true],
    ["src/pages/example.tsx", "@/features/records/play-record", false],
    [
      "src/app/game-integration/example.ts",
      "@/features/records/play-record",
      true,
    ],
    [
      "src/app/navigation/example.ts",
      "@/app/game-integration/game-catalog",
      false,
    ],
    ["src/app/game-home/example.ts", "@/app/shell/AppShell", false],
    [
      "src/features/zukan/example.ts",
      "@/features/records/cleared-problem",
      true,
    ],
    ["src/features/zukan/example.ts", "@/features/records/storage", false],
    [
      "src/features/zukan/example.ts",
      "@/features/records/ui/PlayRecordsPerformance",
      false,
    ],
    ["src/features/records/storage.ts", "@/components/PlayHeader", false],
    [
      "src/features/records/storage.ts",
      "@/features/records/ui/PlayRecordsPerformance",
      false,
    ],
    [
      "src/features/random-play/example.ts",
      "@/features/records/read-play-history",
      true,
    ],
    [
      "src/features/collection/example.ts",
      "@/features/zukan/zukan-collection",
      false,
    ],
    [
      "src/features/collection/example.ts",
      "@/app/game-integration/game-catalog",
      false,
    ],
    [
      "src/features/random-play/example.ts",
      "@/app/game-integration/game-catalog-entry",
      false,
    ],
    [
      "src/features/settings/example.ts",
      "@/features/random-play/random-problem-settings",
      true,
    ],
    [
      "src/components/PlayHeader/example.tsx",
      "@/features/settings/SettingsDialog",
      false,
    ],
    ["src/lib/example.ts", "@/features/zukan/zukan-collection", false],
    ["src/lib/audio/example.ts", "@/features/settings/SettingsDialog", false],
    ["src/lib/audio/example.ts", "@/components/app-background-music", false],
    ["src/lib/audio/example.ts", "@/lib/type-guards", true],
    ["src/features/records/ui/example.ts", "@/lib/audio/sound-effects", true],
    [
      "src/games/bridges/puzzle/example.ts",
      "@/features/records/cleared-problem",
      false,
    ],
    [
      "src/games/bridges/problem/example.ts",
      "@/features/records/play-record",
      false,
    ],
    [
      "src/games/bridges/play/example.ts",
      "@/features/records/play-record",
      false,
    ],
    [
      "src/games/bridges/score.ts",
      "@/features/records/play-record-definition",
      false,
    ],
    [
      "src/games/bridges/ui/BridgesPlay.tsx",
      "@/features/records/play-record",
      false,
    ],
    [
      "src/games/bridges/session/example.ts",
      "@/features/records/cleared-problem",
      false,
    ],
    [
      "src/games/bridges/tutorial/example.ts",
      "@/features/records/cleared-problem",
      false,
    ],
    [
      "src/features/collection/example.test.ts",
      "@/app/game-integration/game-catalog",
      false,
    ],
    ["src/features/records/example.test.ts", "bun:test", false],
  ] as const;

  const registeredBoundaryCases = [
    ...appAreas.map(
      (area) =>
        [
          `src/app/${area}/example.ts`,
          "@/views/PlayRecordsView",
          false,
        ] as const,
    ),
    ...featureAreas.map(
      (area) =>
        [
          `src/features/${area}/example.ts`,
          "@/app/game-integration/game-catalog",
          false,
        ] as const,
    ),
  ];

  test.each([...cases, ...registeredBoundaryCases])(
    "%s から %s への参照を規則どおりに検査できること",
    (file, imported, allowed) => {
      const parent = path.join(frontendDirectory, path.dirname(file));
      const createdDirectories: string[] = [];
      for (
        let current = parent;
        !existsSync(current);
        current = path.dirname(current)
      ) {
        createdDirectories.unshift(current);
      }
      mkdirSync(parent, { recursive: true });
      const directory = mkdtempSync(path.join(parent, "dependency-probe-"));
      const probe = path.join(directory, path.basename(file));
      writeFileSync(
        probe,
        `import { value } from "${imported}";\nvoid value;\n`,
      );

      try {
        const result = spawnSync(
          biome,
          ["lint", "--only=style/noRestrictedImports", probe],
          { cwd: frontendDirectory, encoding: "utf8" },
        );

        const output = result.stdout + result.stderr;
        expect(result.error, output).toBeUndefined();
        if (allowed) {
          expect(result.status, output).toBe(0);
        } else {
          expect(result.status, output).not.toBe(0);
          expect(output).toContain("noRestrictedImports");
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
        for (const created of [...createdDirectories].reverse()) {
          rmdirSync(created);
        }
      }
    },
  );

  test.each([
    ["@/features/records/play-record", true],
    ["@/features/records/storage", false],
    ["@/features/records/ui/PlayRecordsPerformance", false],
  ])("記録アダプターから %s への参照は %s であること", (imported, allowed) => {
    // 実際のアダプターファイル名で検査する。子ディレクトリのprobeでは個別の許可規則に一致しない。
    const scratch = mkdtempSync(
      path.join(tmpdir(), "pa-zzle-adapter-boundary-"),
    );
    try {
      const directory = path.join(scratch, "src/games/bridges");
      mkdirSync(directory, { recursive: true });
      copyFileSync(
        path.join(frontendDirectory, "biome.json"),
        path.join(scratch, "biome.json"),
      );
      writeFileSync(
        path.join(directory, "play-record.ts"),
        `import { value } from "${imported}";\nvoid value;\n`,
      );
      const result = spawnSync(
        biome,
        [
          "lint",
          "--only=style/noRestrictedImports",
          "src/games/bridges/play-record.ts",
        ],
        { cwd: scratch, encoding: "utf8" },
      );
      const output = result.stdout + result.stderr;
      expect(result.error, output).toBeUndefined();
      if (allowed) {
        expect(result.status, output).toBe(0);
      } else {
        expect(result.status, output).not.toBe(0);
        expect(output).toContain("noRestrictedImports");
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test.each([
    ["src/games/bridges/play-record.ts", "@/features/records/play-record"],
    ["src/games/bridges/play-attempt.ts", "@/features/records/play-attempt"],
    [
      "src/games/bridges/ui/play-record-display.ts",
      "@/features/records/ui/play-record-display",
    ],
  ])("記録アダプター %s は必要な共通契約を参照できること", (file, imported) => {
    expect(readFileSync(path.join(frontendDirectory, file), "utf8")).toContain(
      imported,
    );
    const result = spawnSync(
      biome,
      ["lint", "--only=style/noRestrictedImports", file],
      { cwd: frontendDirectory, encoding: "utf8" },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  test("移行後の出題設定に既存のBiome規則を適用できること", () => {
    const result = spawnSync(
      biome,
      [
        "lint",
        "--only=style/noRestrictedImports",
        "src/features/random-play/random-problem-settings.ts",
      ],
      { cwd: frontendDirectory, encoding: "utf8" },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});

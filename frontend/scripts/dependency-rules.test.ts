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
  appAreaDependencies,
  appAreas,
  createDependencyRuleOverrides,
  featureAreas,
  featurePublicImports,
  featurePublicModules,
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

  describe("トップレベル・app・features・libに未登録領域がある場合", () => {
    beforeEach(() => {
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
    });

    test("追加された未登録領域を検出すること", () => {
      const unknown = listUnregisteredSourceAreas(scratchDirectory);

      expect(unknown).toEqual([
        "music",
        "app/audio",
        "features/music",
        "lib/music",
      ]);
    });
  });
});

describe("公開モジュール登録", () => {
  test("全領域の公開モジュールが実在し、feature間の許可は公開契約に含まれること", () => {
    for (const area of appAreas) {
      for (const other of appAreaDependencies[
        area as keyof typeof appAreaDependencies
      ]) {
        expect(appAreas, `app領域: ${area} -> ${other}`).toContain(other);
        expect(area, `app領域: ${area} -> ${other}`).not.toBe(other);
      }
    }
    for (const area of featureAreas) {
      for (const module of featurePublicModules[area]) {
        const location = path.join(
          frontendDirectory,
          `src/features/${area}/${module}`,
        );
        expect(
          existsSync(`${location}.ts`) || existsSync(`${location}.tsx`),
          `公開契約: ${area}/${module}`,
        ).toBe(true);
      }
      for (const target of featureAreas) {
        for (const module of featurePublicImports[area][target] ?? []) {
          expect(
            featurePublicModules[target].includes(module),
            `feature間: ${area} -> ${target}/${module}`,
          ).toBe(true);
        }
      }
    }
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
    [
      "src/app/navigation/example.ts",
      "@/app/game-integration/game-catalog",
      false,
    ],
    [
      "src/app/game-integration/example.ts",
      "@/app/navigation/play-location-state",
      true,
    ],
    ["src/app/game-integration/example.ts", "@/app/shell/AppShell", false],
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
    ["src/features/zukan/example.ts", "@/games/nanpure/puzzle/board", false],
    ["src/features/zukan/example.ts", "@/games/play", true],
    ["src/components/example.tsx", "@/games/play", true],
    ["src/views/example.tsx", "@/features/records/storage", false],
    ["src/app/game-home/example.ts", "@/features/records/storage", false],
    ["src/views/example.test.tsx", "@/features/records/storage", true],
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

  const publicFeatureCases = featureAreas.flatMap((area) => [
    ...featurePublicModules[area].flatMap((module) => [
      [
        `src/app/game-home/example.ts`,
        `@/features/${area}/${module}`,
        true,
      ] as const,
      [`src/views/example.tsx`, `@/features/${area}/${module}`, true] as const,
    ]),
    [
      `src/app/game-home/example.ts`,
      `@/features/${area}/internal-storage`,
      false,
    ] as const,
    [
      `src/views/example.tsx`,
      `@/features/${area}/internal-storage`,
      false,
    ] as const,
  ]);

  const registeredAppAreaCases = appAreas.flatMap((area) => [
    ...appAreas
      .filter((other) => area !== other)
      .flatMap((other) => {
        const allowed = (
          appAreaDependencies[
            area as keyof typeof appAreaDependencies
          ] as readonly string[]
        ).includes(other);
        return [
          [
            `src/app/${area}/example.ts`,
            `@/app/${other}/module`,
            allowed,
          ] as const,
        ];
      }),
    [`src/app/${area}/example.ts`, "@/lib/type-guards", true] as const,
  ]);

  const registeredFeatureAreaCases = featureAreas.flatMap((area) =>
    featureAreas
      .filter((other) => area !== other)
      .flatMap((other) => {
        const permitted = featurePublicImports[area][other] ?? [];
        return [
          ...permitted.map(
            (module) =>
              [
                `src/features/${area}/example.ts`,
                `@/features/${other}/${module}`,
                true,
              ] as const,
          ),
          [
            `src/features/${area}/example.ts`,
            `@/features/${other}/internal-storage`,
            false,
          ] as const,
        ];
      }),
  );

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
    ...registeredAppAreaCases,
    ...registeredFeatureAreaCases,
    ...publicFeatureCases,
  ];

  describe("許可・禁止される参照", () => {
    let probes: {
      probe: string;
      imported: string;
      allowed: boolean;
      directory: string;
      createdDirectories: string[];
    }[];

    beforeEach(() => {
      probes = [...cases, ...registeredBoundaryCases].map(
        ([file, imported, allowed]) => {
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
          return { probe, imported, allowed, directory, createdDirectories };
        },
      );
    });

    afterEach(() => {
      for (const { directory, createdDirectories } of probes) {
        rmSync(directory, { recursive: true, force: true });
        for (const created of [...createdDirectories].reverse()) {
          rmdirSync(created);
        }
      }
    });

    test("実際のBiome CLIで依存制約を検査できること", () => {
      // CLIを毎ケース起動すると検査が遅くなるため、独立したファイルを一括で検査する。
      const result = spawnSync(
        biome,
        [
          "lint",
          "--reporter=json",
          "--max-diagnostics=none",
          "--only=style/noRestrictedImports",
          ...probes.map(({ probe }) => probe),
        ],
        { cwd: frontendDirectory, encoding: "utf8" },
      );
      const report = JSON.parse(result.stdout) as {
        diagnostics: { category: string; location: { path: string } }[];
      };
      const rejectedPaths = new Set(
        report.diagnostics
          .filter((diagnostic) =>
            diagnostic.category.endsWith("noRestrictedImports"),
          )
          .map((diagnostic) => diagnostic.location.path),
      );

      expect(result.error, result.stderr).toBeUndefined();
      for (const { probe, imported, allowed } of probes) {
        const relative = path
          .relative(frontendDirectory, probe)
          .replaceAll(path.sep, "/");
        expect(
          rejectedPaths.has(relative),
          `${relative} -> ${imported}: ${result.stderr}`,
        ).toBe(!allowed);
      }
    });
  });

  const adapterBoundaryCases = [
    ["@/features/records/play-record", true],
    ["@/features/records/storage", false],
    ["@/features/records/ui/PlayRecordsPerformance", false],
  ] as const;

  describe.each(adapterBoundaryCases)(
    "記録アダプターから %s への参照が %s の場合",
    (imported, allowed) => {
      let scratch: string;

      beforeEach(() => {
        // 実際のアダプターファイル名で検査する。子ディレクトリのprobeでは個別の許可規則に一致しない。
        scratch = mkdtempSync(path.join(tmpdir(), "pa-zzle-adapter-boundary-"));
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
      });

      afterEach(() => {
        rmSync(scratch, { recursive: true, force: true });
      });

      test("実際のBiome CLIの判定が公開契約と一致すること", () => {
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
      });
    },
  );

  const recordAdapterCases = [
    ["src/games/bridges/play-record.ts", "@/features/records/play-record"],
    ["src/games/bridges/play-attempt.ts", "@/features/records/play-attempt"],
    [
      "src/games/bridges/ui/play-record-display.ts",
      "@/features/records/ui/play-record-display",
    ],
  ] as const;

  describe.each(recordAdapterCases)("記録アダプター %s", (file, imported) => {
    test("必要な共通契約を参照していること", () => {
      const content = readFileSync(path.join(frontendDirectory, file), "utf8");

      expect(content).toContain(imported);
    });

    test("Biome依存制約を満たすこと", () => {
      const result = spawnSync(
        biome,
        ["lint", "--only=style/noRestrictedImports", file],
        { cwd: frontendDirectory, encoding: "utf8" },
      );

      expect(result.status, result.stdout + result.stderr).toBe(0);
    });
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

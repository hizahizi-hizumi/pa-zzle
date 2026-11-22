import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * biome.json の overrides のうち、frontend/src の依存方向を表す部分を組み立てる。
 * 具体ゲームごとの規則は、`src/games/` 直下のゲームディレクトリ一覧から全ゲームに同じ形で作る。
 */

type RestrictedImportPattern = {
  group: string[];
  message: string;
};

type RestrictedImportsOverride = {
  includes: string[];
  linter: {
    rules: {
      style: {
        noRestrictedImports: {
          level: "error";
          options: { patterns: RestrictedImportPattern[] };
        };
      };
    };
  };
};

export type BiomeOverride = {
  includes: string[];
  linter: { rules: Record<string, unknown> };
};

// 領域を追加するときは、名称と参照可能な領域・公開モジュールを一緒に定義する。
export const appAreaDependencies = {
  navigation: [],
  "game-integration": ["navigation"],
  "game-home": ["navigation", "game-integration"],
  shell: ["navigation", "game-integration", "game-home"],
} as const;
export const appAreas = Object.keys(appAreaDependencies);

type FeatureArea =
  | "records"
  | "zukan"
  | "collection"
  | "random-play"
  | "settings";

// 別featureの内部実装ではなく、ここに明示した公開契約だけを参照する。
export const featurePublicImports: Record<
  FeatureArea,
  Partial<Record<FeatureArea, readonly string[]>>
> = {
  records: {},
  zukan: {
    records: [
      "cleared-problem",
      "play-attempt",
      "play-record",
      "play-record-definition",
      "read-play-history",
    ],
  },
  collection: { records: ["cleared-problem", "play-record"] },
  "random-play": {
    records: ["read-play-history"],
    zukan: ["zukan-collection"],
  },
  settings: { "random-play": ["random-problem-settings"] },
};
export const featureAreas = Object.keys(featurePublicImports) as FeatureArea[];
// app・viewsが使うfeatureの公開契約。内部の保存実装はここへ公開しない。
export const featurePublicModules: Record<FeatureArea, readonly string[]> = {
  records: [
    "cleared-problem",
    "hooks/use-play-attempt-record",
    "hooks/use-save-play-record",
    "play-attempt",
    "play-record",
    "play-record-definition",
    "play-timeline",
    "read-play-history",
    "save-play-record",
    "ui/PlayRecordsPerformance",
    "ui/format-played-at",
    "ui/play-record-display",
    "ui/result-record-feedback",
  ],
  zukan: [
    "ui/ZukanResultPiece",
    "ui/zukan-number-format",
    "ui/zukan-piece-material",
    "ui/zukan-piece-shape",
    "ui/zukan-play-piece",
    "ui/zukan-result-piece-pose",
    "ui/zukan-sheet-layout",
    "ui/zukan-sheet-preview",
    "zukan-collection",
    "zukan-continuation",
    "zukan-filter",
    "zukan-last-viewed",
    "zukan-number",
    "zukan-open-sheet",
    "zukan-sheet-opening",
    "zukan-viewed-history",
  ],
  collection: ["collection"],
  "random-play": [
    "random-problem-selection",
    "random-problem-settings",
    "random-problem-unavailable",
  ],
  settings: [
    "GameCatalogContext",
    "SettingsButton",
    "SettingsDialog",
    "game-selection-order-setting",
  ],
};

export const libAreas = ["audio"] as const;

const sourceAreas = [
  "app",
  "assets",
  "components",
  "features",
  "games",
  "lib",
  "pages",
  "testing",
  "views",
] as const;

const bunImport: RestrictedImportPattern = {
  group: ["bun", "bun:*"],
  message:
    "[test-runtime/bun-import] frontend/src は Bun 固有モジュールへ依存しない。",
};

const absoluteImport: RestrictedImportPattern = {
  group: ["./**", "../**"],
  message:
    "[dependency/absolute-import] frontend/src 内の内部参照は @/... の絶対 import を使う。",
};

const nonCanonicalImport: RestrictedImportPattern = {
  group: ["@/../**", "@/**/../**", "@/**/./**", "@/**//**"],
  message:
    "[dependency/canonical-import] @/ の内部参照には . や .. を含めず、正規パスを使う。",
};

function restrictImports(
  includes: string[],
  patterns: readonly RestrictedImportPattern[],
): RestrictedImportsOverride {
  return {
    includes,
    linter: {
      rules: {
        style: {
          noRestrictedImports: {
            level: "error",
            // override は前の override の patterns を置き換えるので、全 override に絶対 import の規則を含める。
            options: {
              patterns: [
                absoluteImport,
                nonCanonicalImport,
                bunImport,
                ...patterns,
              ],
            },
          },
        },
      },
    },
  };
}

/** 登録された領域はすべて依存境界のoverrideを生成する。 */
function createNewAreaOverrides(): BiomeOverride[] {
  const upperLayerImports = ["@/pages/**", "@/views/**"];
  const publicFeaturePatterns: RestrictedImportPattern[] = featureAreas.map(
    (area) => ({
      group: [
        `@/features/${area}/**`,
        ...featurePublicModules[area].map(
          (module) => `!@/features/${area}/${module}`,
        ),
      ],
      message: `[dependency/public-feature-${area}] ${area} は公開契約から利用する。`,
    }),
  );
  function restrictArea(
    source: string,
    group: string[],
    message: string,
  ): BiomeOverride {
    return restrictImports([source], [{ group, message }]);
  }

  return [
    restrictArea(
      "src/app/**/*.{ts,tsx}",
      upperLayerImports,
      "[dependency/app-boundary] app は pages・views へ逆依存しない。",
    ),
    // 本番コードはfeatureの公開APIを利用する。テストの保存データ準備は例外とする。
    restrictImports(
      ["src/app/**/*.{ts,tsx}", "!src/app/**/*.test.{ts,tsx}"],
      [
        {
          group: upperLayerImports,
          message:
            "[dependency/app-boundary] app は pages・views へ逆依存しない。",
        },
        ...publicFeaturePatterns,
      ],
    ),
    ...appAreas.flatMap((area) => {
      const blocked = appAreas
        .filter(
          (other) =>
            other !== area &&
            !(
              appAreaDependencies[
                area as keyof typeof appAreaDependencies
              ] as readonly string[]
            ).includes(other),
        )
        .map((other) => `@/app/${other}/**`);
      const boundary: RestrictedImportPattern = {
        group: [...upperLayerImports, ...blocked],
        message: `[dependency/app-${area}] ${area} は所有外のアプリ領域へ依存しない。`,
      };
      return [
        restrictImports([`src/app/${area}/**/*.{ts,tsx}`], [boundary]),
        restrictImports(
          [
            `src/app/${area}/**/*.{ts,tsx}`,
            `!src/app/${area}/**/*.test.{ts,tsx}`,
          ],
          [boundary, ...publicFeaturePatterns],
        ),
      ];
    }),
    ...featureAreas.flatMap((area) => {
      const boundaryPatterns: RestrictedImportPattern[] = [
        {
          group: [...upperLayerImports, "@/router", "@/app/**", "@/games/*/**"],
          message: `[dependency/feature-${area}] 機能はアプリ・具体ゲーム内部へ逆依存しない。`,
        },
        ...featureAreas
          .filter((other) => other !== area)
          .map((other) => ({
            group: [
              `@/features/${other}/**`,
              ...(featurePublicImports[area][other] ?? []).map(
                (module) => `!@/features/${other}/${module}`,
              ),
            ],
            message: `[dependency/feature-public-${area}] ${area} は ${other} の公開契約だけを参照する。`,
          })),
      ];
      return [
        restrictImports(
          [`src/features/${area}/**/*.{ts,tsx}`],
          boundaryPatterns,
        ),
        ...(area === "records"
          ? [
              restrictImports(
                [
                  "src/features/records/**/*.{ts,tsx}",
                  "!src/features/records/hooks/**",
                  "!src/features/records/ui/**",
                ],
                [
                  ...boundaryPatterns,
                  {
                    group: [
                      "@/components/**",
                      "@/features/records/ui/**",
                      "@/features/records/hooks/**",
                      "react",
                      "react*",
                    ],
                    message:
                      "[dependency/records-core] 記録の中核は UI・hooks・React へ依存しない。",
                  },
                ],
              ),
            ]
          : []),
      ];
    }),
    restrictImports(
      ["src/views/**/*.{ts,tsx}", "!src/views/**/*.test.{ts,tsx}"],
      [
        {
          group: ["@/pages/**"],
          message: "[dependency/views-boundary] View は pages へ逆依存しない。",
        },
        ...publicFeaturePatterns,
      ],
    ),
  ];
}

function gamesCommonBoundaryImports(): string[] {
  return [
    "@/components/**",
    "@/app/**",
    "@/features/**",
    "@/games/*/**",
    "@/views/**",
    "@/pages/**",
    "@/router",
  ];
}

function createApplicationLayerOverrides(): BiomeOverride[] {
  return [
    restrictImports(["src/**/*.{ts,tsx}"], []),
    restrictImports(
      ["src/pages/**/*.{ts,tsx}"],
      [
        {
          group: [
            "@/components/**",
            "@/games/**",
            "@/lib/**",
            "@/app/**",
            "@/features/**",
          ],
          message:
            "[dependency/pages-boundary] pages はルートと View の対応だけを持ち、画面の依存は View が合成する。",
        },
      ],
    ),
    restrictImports(
      ["src/views/**/*.{ts,tsx}"],
      [
        {
          group: ["@/pages/**"],
          message:
            "[dependency/views-boundary] View は画面合成境界であり pages へ逆依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/components/**/*.{ts,tsx}", "!src/components/ui"],
      [
        {
          group: [
            "@/games/*/**",
            "@/app/**",
            "@/features/**",
            "@/views/**",
            "@/pages/**",
          ],
          message:
            "[dependency/components-boundary] 共通UIは具体ゲーム・アプリ統合・機能内部・画面合成へ依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/lib/**/*.{ts,tsx}"],
      [
        {
          group: [
            "@/components/**",
            "@/games/**",
            "@/app/**",
            "@/features/**",
            "@/views/**",
            "@/pages/**",
            "@/router",
            "react*",
          ],
          message:
            "[dependency/lib-boundary] lib はアプリ固有責務・React・ルーティングへ依存しない。",
        },
      ],
    ),

    restrictImports(
      [
        "src/games/*.{ts,tsx}",
        "!src/games/play.ts",
        "!src/games/play-sound-effects.ts",
      ],
      [
        {
          group: [...gamesCommonBoundaryImports(), "react*"],
          message:
            "[dependency/games-common-boundary] ゲーム共通契約は具体ゲーム・記録・React・UI合成へ依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/games/play.ts", "src/games/play-sound-effects.ts"],
      [
        {
          group: gamesCommonBoundaryImports(),
          message:
            "[dependency/games-common-play-boundary] ゲーム共通のプレイ進行と効果音は React へだけ依存でき、具体ゲーム・記録・UI合成へ依存しない。",
        },
      ],
    ),
    ...createNewAreaOverrides(),
    {
      includes: [
        "src/pages/**/*.{ts,tsx}",
        "vite*.config.ts",
        "vitest.config.ts",
      ],
      linter: { rules: { style: { noDefaultExport: "off" } } },
    },
  ];
}

function crossGamePattern(
  games: readonly string[],
  game: string,
  layers: readonly string[],
): RestrictedImportPattern {
  return {
    group: games
      .filter((other) => other !== game)
      .flatMap((other) => layers.map((layer) => `@/${layer}/${other}/**`)),
    message:
      "[dependency/cross-game-boundary] concrete game 同士を直接依存させない。",
  };
}

function concreteGameBoundary(
  allowedImports: readonly string[] = [],
): RestrictedImportPattern {
  return {
    group: [
      "@/app/**",
      "@/features/**",
      ...allowedImports.map((allowed) => `!${allowed}`),
      "@/views/**",
      "@/pages/**",
      "@/router",
    ],
    message:
      "[dependency/concrete-game-boundary] ゲーム固有の処理はアプリ統合・記録UI・画面合成・ルートへ逆依存しない。",
  };
}

function createConcreteGameOverrides(
  games: readonly string[],
  game: string,
): BiomeOverride[] {
  function gameImport(path: string) {
    return `@/games/${game}/${path}`;
  }
  function gameFiles(path: string) {
    return [`src/games/${game}/${path}`];
  }
  const crossGame = crossGamePattern(games, game, ["games"]);
  const boundary = [concreteGameBoundary(), crossGame];

  return [
    restrictImports(gameFiles("**/*.{ts,tsx}"), boundary),
    restrictImports(
      [
        "play-record.ts",
        "play-record.test.ts",
        "play-attempt.ts",
        "ui/play-record-display.ts",
        "ui/play-record-display.test.ts",
      ].flatMap(gameFiles),
      [
        // 記録に関するゲームのアダプターだけが共通記録契約へ接続する。
        concreteGameBoundary([
          "@/features/records/play-record",
          "@/features/records/play-record-definition",
          "@/features/records/play-attempt",
          "@/features/records/ui/play-record-display",
        ]),
        crossGame,
      ],
    ),
    restrictImports(gameFiles("puzzle/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("problem/**"),
          gameImport("session/**"),
          gameImport("play/**"),
          gameImport("tutorial/**"),
          gameImport("ui/**"),
        ],
        message:
          "[dependency/game-puzzle-layer] puzzle は problem・session・play・tutorial・ui へ依存しない。",
      },
    ]),
    restrictImports(gameFiles("problem/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("session/**"),
          gameImport("play/**"),
          gameImport("tutorial/**"),
          gameImport("ui/**"),
        ],
        message:
          "[dependency/game-problem-layer] problem は session・play・tutorial・ui へ依存しない。",
      },
    ]),
    restrictImports(gameFiles("session/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("problem/generation/**"),
          gameImport("difficulty"),
          gameImport("score"),
          gameImport("play/**"),
          gameImport("tutorial/**"),
          gameImport("ui/**"),
          gameImport("play-record"),
          "@/features/records/**",
          "react*",
        ],
        message:
          "[dependency/game-session-layer] session は生成内部・難易度分類・採点・play・tutorial・保存・React・ui へ依存しない。",
      },
    ]),
    restrictImports(gameFiles("tutorial/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("problem/generation/**"),
          gameImport("difficulty"),
          gameImport("score"),
          gameImport("play/**"),
          gameImport("ui/**"),
          gameImport("play-record"),
          "@/features/records/**",
          "react*",
        ],
        message:
          "[dependency/game-tutorial-layer] tutorial は生成内部・難易度分類・採点・play・保存・React・ui へ依存しない。",
      },
    ]),
    restrictImports(gameFiles("play/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("ui/**"),
          gameImport("tutorial/**"),
          gameImport("problem/generation/**"),
          gameImport("play-record"),
          gameImport("diagnostics"),
        ],
        message:
          "[dependency/game-play-layer] play は ui・tutorial・生成内部・記録接続・診断接続へ逆依存しない。",
      },
    ]),
  ];
}

function createGameIntegrationOverrides(
  games: readonly string[],
): BiomeOverride[] {
  return games.map((game) =>
    restrictImports(
      [`src/app/game-integration/${game}/**/*.{ts,tsx}`],
      [crossGamePattern(games, game, ["games", "app/game-integration"])],
    ),
  );
}

function createTestOverride(): BiomeOverride {
  return {
    includes: ["src/**/*.test.{ts,tsx,mjs}"],
    linter: {
      rules: {
        style: {
          noRestrictedGlobals: {
            level: "error",
            options: {
              deniedGlobals: {
                Bun: "テストは Bun グローバルへ依存しない。",
              },
            },
          },
        },
      },
    },
  };
}

export function createDependencyRuleOverrides(
  games: readonly string[],
): BiomeOverride[] {
  return [
    ...createApplicationLayerOverrides(),
    ...games.flatMap((game) => createConcreteGameOverrides(games, game)),
    ...createGameIntegrationOverrides(games),
    restrictImports(["src/**/*.test.mjs"], []),
    createTestOverride(),
  ];
}

/** 新しい責務ディレクトリを登録せずに追加するとCIで検出する。 */
export function listUnregisteredSourceAreas(sourceDirectory: string): string[] {
  const registered: readonly [string, readonly string[]][] = [
    [".", sourceAreas],
    ["app", appAreas],
    ["features", featureAreas],
    ["lib", libAreas],
  ];
  return registered.flatMap(([directory, areas]) => {
    const location = path.join(sourceDirectory, directory);
    if (!existsSync(location)) {
      return [];
    }
    return readdirSync(location, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !areas.includes(entry.name))
      .map((entry) =>
        path.posix.join(directory, entry.name).replace(/^\.\//, ""),
      );
  });
}

/** `src/games/` 直下のディレクトリを具体ゲームとして名前順に返す。 */
export function listConcreteGames(gamesDirectory: string): string[] {
  return readdirSync(gamesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

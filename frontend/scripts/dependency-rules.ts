import { readdirSync } from "node:fs";

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

const absoluteImport: RestrictedImportPattern = {
  group: ["./**", "../**"],
  message:
    "[dependency/absolute-import] frontend/src 内の内部参照は @/... の絶対 import を使う。",
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
            options: { patterns: [absoluteImport, ...patterns] },
          },
        },
      },
    },
  };
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
            "@/game-catalog/**",
            "@/games/**",
            "@/lib/**",
            "@/records/**",
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
            "@/game-catalog/**",
            "@/records/**",
            "@/views/**",
            "@/pages/**",
          ],
          message:
            "[dependency/components-boundary] 共有コンポーネントは具体ゲーム・ゲームカタログ・記録・画面合成・pages へ依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/lib/**/*.{ts,tsx}"],
      [
        {
          group: [
            "@/components/**",
            "@/game-catalog/**",
            "@/games/**",
            "@/records/**",
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
      ["src/games/*.{ts,tsx}"],
      [
        {
          group: [
            "@/components/**",
            "@/game-catalog/**",
            "@/games/*/**",
            "@/records/**",
            "@/views/**",
            "@/pages/**",
            "@/router",
            "react*",
          ],
          message:
            "[dependency/games-common-boundary] ゲーム共通契約は具体ゲーム・記録・React・UI合成へ依存しない。",
        },
      ],
    ),
    restrictImports(
      [
        "src/records/**/*.{ts,tsx}",
        "!src/records/hooks/**",
        "!src/records/ui/**",
      ],
      [
        {
          group: [
            "@/components/**",
            "@/game-catalog/**",
            "@/games/*/**",
            "@/records/hooks/**",
            "@/records/ui/**",
            "@/views/**",
            "@/pages/**",
            "@/router",
            "react*",
          ],
          message:
            "[dependency/records-core-boundary] 記録の中核は具体ゲーム・React・UI・画面合成へ依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/records/hooks/**/*.{ts,tsx}"],
      [
        {
          group: [
            "@/components/**",
            "@/game-catalog/**",
            "@/games/*/**",
            "@/records/ui/**",
            "@/views/**",
            "@/pages/**",
            "@/router",
          ],
          message:
            "[dependency/records-hooks-boundary] 記録 hooks は記録中核を React へ接続し、具体ゲーム・UI・画面合成へ依存しない。",
        },
      ],
    ),
    restrictImports(
      ["src/records/ui/**/*.{ts,tsx}"],
      [
        {
          group: [
            "@/game-catalog/**",
            "@/games/*/**",
            "@/views/**",
            "@/pages/**",
            "@/router",
            "react-router",
            "react-router/**",
          ],
          message:
            "[dependency/records-ui-boundary] 記録 UI は具体ゲーム・画面合成・ルーティングへ逆依存しない。",
        },
      ],
    ),
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
      "@/game-catalog/**",
      "@/records/hooks/**",
      "@/records/ui/**",
      ...allowedImports.map((allowed) => `!${allowed}`),
      "@/views/**",
      "@/pages/**",
      "@/router",
    ],
    message:
      "[dependency/concrete-game-boundary] concrete game はゲームカタログ・記録UI・画面合成・pages・router へ逆依存しない。",
  };
}

function createConcreteGameOverrides(
  games: readonly string[],
  game: string,
): BiomeOverride[] {
  const gameImport = (path: string) => `@/games/${game}/${path}`;
  const gameFiles = (path: string) => [`src/games/${game}/${path}`];
  const crossGame = crossGamePattern(games, game, ["games"]);
  const boundary = [concreteGameBoundary(), crossGame];

  return [
    restrictImports(gameFiles("**/*.{ts,tsx}"), boundary),
    restrictImports(gameFiles("ui/play-record-display.ts"), [
      // 記録表示の定義は、記録 UI が受け取る表示契約へゲームを接続する。
      concreteGameBoundary(["@/records/ui/play-record-display"]),
      crossGame,
    ]),
    restrictImports(gameFiles("puzzle/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("problem/**"),
          gameImport("session/**"),
          gameImport("play/**"),
          gameImport("ui/**"),
        ],
        message:
          "[dependency/game-puzzle-layer] puzzle は problem・session・play・ui へ依存しない。",
      },
    ]),
    restrictImports(gameFiles("problem/**/*.{ts,tsx}"), [
      ...boundary,
      {
        group: [
          gameImport("session/**"),
          gameImport("play/**"),
          gameImport("ui/**"),
        ],
        message:
          "[dependency/game-problem-layer] problem は session・play・ui へ依存しない。",
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
          gameImport("ui/**"),
          gameImport("play-record"),
          "@/records/**",
          "react*",
        ],
        message:
          "[dependency/game-session-layer] session は生成内部・難易度分類・採点・play・保存・React・ui へ依存しない。",
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
          "@/records/**",
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
          gameImport("problem/generation/**"),
          gameImport("play-record"),
          gameImport("diagnostics"),
        ],
        message:
          "[dependency/game-play-layer] play は ui・生成内部・記録接続・診断接続へ逆依存しない。",
      },
    ]),
  ];
}

const gameCatalogBoundary: RestrictedImportPattern = {
  group: ["@/views/**", "@/pages/**"],
  message:
    "[dependency/game-catalog-boundary] ゲームカタログは画面合成・pages へ逆依存しない。",
};

function createGameCatalogOverrides(games: readonly string[]): BiomeOverride[] {
  return [
    restrictImports(["src/game-catalog/**/*.{ts,tsx}"], [gameCatalogBoundary]),
    ...games.map((game) =>
      restrictImports(
        [`src/game-catalog/${game}/**/*.{ts,tsx}`],
        [
          gameCatalogBoundary,
          crossGamePattern(games, game, ["games", "game-catalog"]),
        ],
      ),
    ),
  ];
}

function createTestOverride(): BiomeOverride {
  return {
    includes: ["src/**/*.test.{ts,tsx,mjs}"],
    linter: {
      rules: {
        style: {
          noRestrictedImports: {
            level: "error",
            options: {
              patterns: [
                absoluteImport,
                {
                  group: ["bun", "bun:*"],
                  message:
                    "[test-runtime/bun-import] テストは bun:test / Bun 固有モジュールへ依存しない。",
                },
              ],
            },
          },
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
    ...createGameCatalogOverrides(games),
    createTestOverride(),
  ];
}

/** `src/games/` 直下のディレクトリを具体ゲームとして名前順に返す。 */
export function listConcreteGames(gamesDirectory: string): string[] {
  return readdirSync(gamesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { gameCatalog } from "@/game-catalog/game-catalog";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

// リフレクションは実装途中で、記録の定義と結果画面をつないだ段でゲームカタログへ載せる。
const gamesNotInCatalogYet = ["reflection"];

describe("gameCatalog", () => {
  const concreteGames = readdirSync(
    fileURLToPath(new URL("../games", import.meta.url)),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !gamesNotInCatalogYet.includes(name))
    .sort();

  test("src/games の全ゲームを1つずつ持つこと", () => {
    const gameIds = gameCatalog.map((game) => game.id).sort();

    expect(gameIds).toEqual(concreteGames);
  });
});

// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  findRecordProblemPlayDestination,
  gameCatalog,
} from "@/game-catalog/game-catalog";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

// 詰将棋は実装途中で、記録の定義と結果画面をつないだ段でゲームカタログへ載せる。
const gamesNotInCatalogYet = ["tsume-shogi"];

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

describe("findRecordProblemPlayDestination", () => {
  const problem = selectMinesweeperProblemForDifficulty("1", "records");
  const record = createMinesweeperPlayRecord({
    difficulty: "1",
    problemIdentity: problem.identity,
    startedAt: 1_000,
    completedAt: 121_000,
    result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
  });
  const unknownGameRecord = { ...record, gameId: "unknown-game" };

  test("記録のゲームのプレイ画面と、記録の難易度・問題IDを返すこと", () => {
    const destination = findRecordProblemPlayDestination(record);

    expect(destination).toEqual({
      playPath: "/puzzles/minesweeper/play/:difficulty",
      difficulty: "1",
      problemId: createProblemId(problem.identity),
    });
  });

  test("今のアプリに無いゲームの記録には null を返すこと", () => {
    const destination = findRecordProblemPlayDestination(unknownGameRecord);

    expect(destination).toBeNull();
  });
});

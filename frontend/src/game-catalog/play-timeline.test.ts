import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import {
  describePlayTimelineEntry,
  findPlayTimelineEntryDestination,
  listCatalogPlayTimelineEntries,
} from "@/game-catalog/play-timeline";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemId } from "@/games/problem-id";
import type { PlayAttempt } from "@/records/play-attempt";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

vi.mock("@/lib/internal-diagnostics", () => ({
  internalDiagnosticsAvailable: false,
  buildRevision: null,
}));

const problem = selectMinesweeperProblemForDifficulty("2", "timeline");
const problemId = createProblemId(problem.identity);
const record = createMinesweeperPlayRecord({
  difficulty: "2",
  problemIdentity: problem.identity,
  startedAt: 1_000,
  completedAt: 121_000,
  result: { elapsedMs: 120_000, mistakeCount: 0, minimumOpenCount: 10 },
});
const attempt: PlayAttempt = {
  gameId: "minesweeper",
  startedAt: 200_000,
  start: { difficulty: "2", problemIdentity: problem.identity },
  abandonment: { abandonedAt: 230_000, progress: { elapsedMs: 30_000 } },
};
const unknownGameRecord = { ...record, id: "unknown", gameId: "unknown-game" };
const levelOneProblemCount =
  minesweeperCatalogEntry.listPoolProblemIds("1").length;
const levelTwoIndex = minesweeperCatalogEntry
  .listPoolProblemIds("2")
  .indexOf(problemId);

describe("listCatalogPlayTimelineEntries", () => {
  test("今のアプリにあるゲームのプレイだけを、新しい順に並べること", () => {
    const entries = listCatalogPlayTimelineEntries(
      [record, unknownGameRecord],
      [attempt],
    );

    expect(entries.map(({ kind }) => kind)).toEqual(["abandoned", "cleared"]);
  });
});

describe("describePlayTimelineEntry", () => {
  const [abandonedEntry, clearedEntry] = listCatalogPlayTimelineEntries(
    [record],
    [attempt],
  );

  test("完了記録に、ゲーム・レベル・ゲームの中を通した図鑑の番号・評価点を添えること", () => {
    const description = clearedEntry && describePlayTimelineEntry(clearedEntry);

    expect(description).toMatchObject({
      gameName: minesweeperCatalogEntry.name,
      levelLabel: "レベル 2",
      zukanNumber: { number: levelOneProblemCount + levelTwoIndex + 1 },
      score: getPlayRecordMetricValue(
        record,
        minesweeperCatalogEntry.playRecordDisplay.definition,
        "play-score",
      ),
    });
  });

  test("離脱したプレイには、評価点を添えないこと", () => {
    const description =
      abandonedEntry && describePlayTimelineEntry(abandonedEntry);

    expect(description?.score).toBeNull();
    expect(description?.zukanNumber?.number).toBe(
      levelOneProblemCount + levelTwoIndex + 1,
    );
  });
});

describe("findPlayTimelineEntryDestination", () => {
  const [abandonedEntry, clearedEntry] = listCatalogPlayTimelineEntries(
    [record],
    [attempt],
  );

  test("結果画面を描ける記録には、その記録の結果画面を返すこと", () => {
    const destination =
      clearedEntry && findPlayTimelineEntryDestination(clearedEntry);

    expect(destination).toMatchObject({ kind: "result", record });
  });

  test("離脱したプレイには、その問題を選んだゲームのホームを返すこと", () => {
    const destination =
      abandonedEntry && findPlayTimelineEntryDestination(abandonedEntry);

    expect(destination).toMatchObject({ kind: "game-home", problemId });
  });
});

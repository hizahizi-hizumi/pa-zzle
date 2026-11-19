import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import {
  describePlayTimelineEntry,
  findPlayTimelineEntryDestination,
  listCatalogPlayTimelineEntries,
} from "@/app/game-integration/play-timeline";
import { waterSortCatalogEntry } from "@/app/game-integration/water-sort/water-sort-catalog-entry";
import type { PlayAttempt } from "@/features/records/play-attempt";
import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import { createMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { createProblemId } from "@/games/problem-id";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";

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

describe("旧形式の記録", () => {
  const currentWaterSortRecord = createWaterSortPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "old-water-sort",
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: 300_000,
    completedAt: 370_000,
    result: {
      elapsedMs: 70_000,
      moveCount: 14,
      completionMoveCount: 12,
      undoCount: 2,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  });
  const { completionMoveCount: _unused, ...oldWaterSortPerformance } =
    currentWaterSortRecord.payload.performance;
  const oldWaterSortRecord = {
    ...currentWaterSortRecord,
    payloadVersion: 1,
    payload: {
      ...currentWaterSortRecord.payload,
      difficulty: "normal",
      performance: oldWaterSortPerformance,
    },
  };
  const currentParkingJamRecord = createParkingJamPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "2",
      seed: "old-parking-jam",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 14,
        roadOpeningCount: 4,
        roadOpeningSpan: 2,
        fixedAreaCount: 2,
        fixedAreaLength: 2,
        blockingPlacementProbability: 0,
      },
      generationAttempt: 2,
    },
    speedReference: { vehicleCount: 14, initialBlockedVehicleCount: 6 },
    startedAt: 380_000,
    completedAt: 480_000,
    result: {
      elapsedMs: 100_000,
      moveAttemptCount: 16,
      successfulMoveCount: 15,
      failedMoveCount: 1,
      undoCount: 1,
      restartCount: 0,
    },
  });
  const oldParkingJamRecord = {
    ...currentParkingJamRecord,
    payloadVersion: 3,
    payload: { ...currentParkingJamRecord.payload, difficulty: "hard" },
  };
  const cases = [
    ["ウォーターソート", oldWaterSortRecord, "ふつう", waterSortCatalogEntry],
    [
      "パーキングジャム",
      oldParkingJamRecord,
      "むずかしい",
      parkingJamCatalogEntry,
    ],
  ] as const;

  test.each(cases)(
    "旧記録を履歴に残し、結果を開けないことを示してゲームのホームへ案内すること: %s",
    (_label, oldRecord, levelLabel, game) => {
      const [entry] = listCatalogPlayTimelineEntries([oldRecord], []);
      if (!entry) throw new Error("記録が履歴に含まれていません");

      const description = describePlayTimelineEntry(entry);
      const destination = findPlayTimelineEntryDestination(entry);
      const replayTarget = game.recordProblemPlayTarget(oldRecord);

      expect(description).toMatchObject({
        levelLabel,
        score: null,
        resultUnavailable: true,
      });
      expect(destination).toMatchObject({ kind: "game-home", game });
      expect(replayTarget).toBeNull();
    },
  );
});

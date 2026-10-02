import {
  createMinesweeperPlayRecord,
  getMinesweeperPlayRecordScore,
  getMinesweeperPlayRecordTimeDelta,
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
  restoreMinesweeperRecordedResult,
} from "@/games/minesweeper/play-record";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperSpeedFullScoreMs,
  calculateMinesweeperTimeDeltaMs,
} from "@/games/minesweeper/score";
import type { PlayRecord } from "@/records/play-record";

function createRecord() {
  return createMinesweeperPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "ms-pool-3-10x10-16-0",
      conditions: {
        rows: 10,
        columns: 10,
        mineCount: 16,
        startCellPlacement: "random",
      },
      generationAttempt: 1,
    },
    startedAt: 1_000,
    completedAt: 151_000,
    result: { elapsedMs: 150_000, mistakeCount: 0, minimumOpenCount: 25 },
  });
}

test("評価値を保存せず評価元の事実だけを保存用記録へ写すこと", () => {
  const record = createRecord();

  expect(record.gameId).toBe("minesweeper");
  expect(record.payloadVersion).toBe(1);
  expect(record.payload.performance).toEqual({
    elapsedMs: 150_000,
    mistakeCount: 0,
    minimumOpenCount: 25,
  });
  expect(isMinesweeperPlayRecord(record)).toBe(true);
});

test("保存した事実から現在のプレイ評価を再計算すること", () => {
  const record = createRecord();

  const score = getMinesweeperPlayRecordScore(record);

  expect(score).toBe(
    calculateMinesweeperPlayScore({
      elapsedMs: 150_000,
      mistakeCount: 0,
      minimumOpenCount: 25,
      mineCount: 16,
    }).total,
  );
  expect(score).toBe(90);
});

test("問題ごとの基準時間との差を比較指標として導出すること", () => {
  const record = createRecord();

  const timeDelta = getMinesweeperPlayRecordTimeDelta(record);

  expect(timeDelta).toBe(31_000);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const record = createRecord();

  const comparisonKey =
    minesweeperPlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("3");
});

test("解釈できない記録を評価しないこと", () => {
  const record: PlayRecord = {
    ...createRecord(),
    payload: { difficulty: "3", performance: { elapsedMs: 1 } },
  };

  expect(isMinesweeperPlayRecord(record)).toBe(false);
  expect(getMinesweeperPlayRecordScore(record)).toBeNull();
  expect(getMinesweeperPlayRecordTimeDelta(record)).toBeNull();
});

describe("restoreMinesweeperRecordedResult", () => {
  const record = createRecord();
  const { performance } = record.payload;

  describe("今の版の記録の場合", () => {
    test("記録の難易度・問題・成績から結果を作り直すこと", () => {
      const recorded = restoreMinesweeperRecordedResult(record);

      expect(recorded).toEqual({
        difficulty: "3",
        problemIdentity: record.payload.problemIdentity,
        result: {
          ...performance,
          mineCount: 16,
          speedFullScoreMs: calculateMinesweeperSpeedFullScoreMs({
            minimumOpenCount: 25,
            mineCount: 16,
          }),
          timeDeltaMs: calculateMinesweeperTimeDeltaMs({
            ...performance,
            mineCount: 16,
          }),
          score: calculateMinesweeperPlayScore({
            ...performance,
            mineCount: 16,
          }),
        },
      });
    });
  });

  const unrestorableRecords: readonly (readonly [string, PlayRecord])[] = [
    ["別の版の記録", { ...record, payloadVersion: 2 }],
    [
      "今と違う生成器の問題の記録",
      {
        ...record,
        payload: {
          ...record.payload,
          problemIdentity: {
            ...record.payload.problemIdentity,
            generatorVersion: "0",
          },
        },
      },
    ],
    ["別のゲームの記録", { ...record, gameId: "nanpure" }],
  ];

  test.each(unrestorableRecords)("%sには null を返すこと", (_, target) => {
    const recorded = restoreMinesweeperRecordedResult(target);

    expect(recorded).toBeNull();
  });
});

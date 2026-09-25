import type { PlayRecord } from "@/records/play-record";
import {
  createMinesweeperPlayRecord,
  getMinesweeperPlayRecordScore,
  getMinesweeperPlayRecordTimeDelta,
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "./play-record";
import { calculateMinesweeperPlayScore } from "./score";

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
  expect(score).toBe(92);
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

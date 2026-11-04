import {
  _private,
  createHakoiriMusumePlayRecord,
  hakoiriMusumePlayRecordDefinition,
  isHakoiriMusumePlayRecord,
  restoreHakoiriMusumeRecordedResult,
} from "@/games/hakoiri-musume/play-record";
import type { PlayRecord } from "@/records/play-record";

const {
  getHakoiriMusumePlayRecordMoveDelta,
  getHakoiriMusumePlayRecordScore,
  getHakoiriMusumePlayRecordTimeDelta,
} = _private;

// 合意の易しい例（最短13手）。基準時間は 15秒 + 13手 × 4秒 = 67秒。
const seed = "vAAvwAAwv..vwhiws..s";
const record = createHakoiriMusumePlayRecord({
  difficulty: "1",
  problemIdentity: { generatorVersion: "1", seed, conditions: {} },
  startedAt: 1_000,
  completedAt: 81_000,
  result: {
    elapsedMs: 80_000,
    moveCount: 20,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 13,
  },
});

function withPerformance(performance: Record<string, unknown>): PlayRecord {
  return {
    ...record,
    payload: {
      ...record.payload,
      performance: { ...record.payload.performance, ...performance },
    },
  };
}

test("評価値を保存せず評価元の事実と最短手数だけを保存用記録へ写すこと", () => {
  const performance = record.payload.performance;

  expect(record.id).toBe(`hakoiri-musume:1000:81000:${seed}`);
  expect(performance).toEqual({
    elapsedMs: 80_000,
    moveCount: 20,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 13,
  });
});

test("保存した事実から現在のプレイ評価と比較指標を導出すること", () => {
  const score = getHakoiriMusumePlayRecordScore(record);
  const timeDelta = getHakoiriMusumePlayRecordTimeDelta(record);
  const moveDelta = getHakoiriMusumePlayRecordMoveDelta(record);

  expect(score).toBe(74);
  expect(timeDelta).toBe(13_000);
  expect(moveDelta).toBe(7);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const comparisonKey =
    hakoiriMusumePlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("1");
});

describe("isHakoiriMusumePlayRecord", () => {
  const invalidCases = [
    ["最短手数より少ない手数", withPerformance({ moveCount: 12 })],
    ["手数を超える待った", withPerformance({ undoCount: 21 })],
    ["負の時間", withPerformance({ elapsedMs: -1 })],
  ] as const;

  test.each(invalidCases)(
    "成り立たない事実の記録を拒むこと: %s",
    (_, value) => {
      const accepted = isHakoiriMusumePlayRecord(value);

      expect(accepted).toBe(false);
    },
  );
});

describe("restoreHakoiriMusumeRecordedResult", () => {
  test("今の版の記録から結果画面の内容を作り直すこと", () => {
    const restored = restoreHakoiriMusumeRecordedResult(record);

    expect(restored).toMatchObject({
      difficulty: "1",
      problemIdentity: record.payload.problemIdentity,
      result: { moveCount: 20, moveDelta: 7, timeDeltaMs: 13_000 },
    });
    expect(restored?.result.score.total).toBe(74);
  });

  describe("別の生成器の版の記録の場合", () => {
    const otherVersion: PlayRecord = {
      ...record,
      payload: {
        ...record.payload,
        problemIdentity: { generatorVersion: "0", seed: "old", conditions: {} },
      },
    };

    test("記録としては読み、結果画面は作り直さないこと", () => {
      const accepted = isHakoiriMusumePlayRecord(otherVersion);
      const restored = restoreHakoiriMusumeRecordedResult(otherVersion);

      expect(accepted).toBe(true);
      expect(restored).toBeNull();
    });
  });
});

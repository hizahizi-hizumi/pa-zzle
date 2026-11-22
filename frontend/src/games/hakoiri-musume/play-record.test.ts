import type { PlayRecord } from "@/features/records/play-record";
import {
  _private,
  createHakoiriMusumePlayRecord,
  hakoiriMusumePlayRecordDefinition,
  isHakoiriMusumePlayRecord,
  restoreHakoiriMusumeRecordedResult,
} from "@/games/hakoiri-musume/play-record";
import { listHakoiriMusumePoolEntries } from "@/games/hakoiri-musume/problem/problem-pool";

const {
  getHakoiriMusumePlayRecordMoveDelta,
  getHakoiriMusumePlayRecordScore,
  getHakoiriMusumePlayRecordTimeDelta,
} = _private;

// 易しい例（最短13手・準備6手）。基準時間は 10秒 + 13手 × 2.5秒 + 6手 × 2.5秒 = 57.5秒。
const seed = "vAAvwAAwv..vwhiws..s";
const record = createHakoiriMusumePlayRecord({
  difficulty: "1",
  problemIdentity: { generatorVersion: "1", seed, conditions: {} },
  startedAt: 1_000,
  completedAt: 81_000,
  result: {
    elapsedMs: 80_000,
    moveCount: 20,
    completionMoveCount: 16,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 13,
    preparationLength: 6,
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

test("評価値を保存せず評価元の事実と問題の作業の量だけを保存用記録へ写すこと", () => {
  const performance = record.payload.performance;

  expect(record.id).toBe(`hakoiri-musume:1000:81000:${seed}`);
  expect(performance).toEqual({
    elapsedMs: 80_000,
    moveCount: 20,
    completionMoveCount: 16,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 13,
    preparationLength: 6,
  });
});

test("保存した事実から現在のプレイ評価と比較指標を導出すること", () => {
  const score = getHakoiriMusumePlayRecordScore(record);
  const timeDelta = getHakoiriMusumePlayRecordTimeDelta(record);
  const moveDelta = getHakoiriMusumePlayRecordMoveDelta(record);

  expect(score).toBe(74);
  expect(timeDelta).toBe(22_000);
  expect(moveDelta).toBe(7);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const comparisonKey =
    hakoiriMusumePlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("1");
});

test("クリアの成績として、経過時間と、完成した盤面までの手数と最短手数を読むこと", () => {
  const performance =
    hakoiriMusumePlayRecordDefinition.getClearPerformance(record);

  expect(performance).toEqual({
    elapsedMs: 80_000,
    moves: { completionMoveCount: 16, optimalMoveCount: 13 },
  });
});

describe("isHakoiriMusumePlayRecord", () => {
  const invalidCases = [
    ["最短手数より少ない手数", withPerformance({ moveCount: 12 })],
    ["手数を超える待った", withPerformance({ undoCount: 21 })],
    ["負の時間", withPerformance({ elapsedMs: -1 })],
    ["最短手数に届く準備の長さ", withPerformance({ preparationLength: 13 })],
    ["準備の長さが無い", withPerformance({ preparationLength: undefined })],
    ["完成時の手数が無い", withPerformance({ completionMoveCount: undefined })],
    [
      "指した手の数を超える完成時の手数",
      withPerformance({ completionMoveCount: 21 }),
    ],
    [
      "最短手数より少ない完成時の手数",
      withPerformance({ completionMoveCount: 12 }),
    ],
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
      result: {
        moveCount: 20,
        completionMoveCount: 16,
        moveDelta: 7,
        timeDeltaMs: 22_000,
      },
    });
    expect(restored?.result.score.total).toBe(74);
  });

  describe("記録の最短手数と準備の長さが、問題集と食い違う場合", () => {
    const [board, optimalMoveCount, preparationLength] =
      listHakoiriMusumePoolEntries("3")[0]!;
    const mismatched = createHakoiriMusumePlayRecord({
      difficulty: "3",
      problemIdentity: { generatorVersion: "1", seed: board, conditions: {} },
      startedAt: 1_000,
      completedAt: 101_000,
      result: {
        elapsedMs: 100_000,
        moveCount: optimalMoveCount + 10,
        completionMoveCount: optimalMoveCount + 2,
        undoCount: 0,
        restartCount: 0,
        optimalMoveCount: optimalMoveCount + 1,
        preparationLength: preparationLength - 1,
      },
    });

    test("記録の値で結果を作り直し、自己ベストと同じ評価にすること", () => {
      const restored = restoreHakoiriMusumeRecordedResult(mismatched);

      expect(restored?.result).toMatchObject({
        optimalMoveCount: optimalMoveCount + 1,
        preparationLength: preparationLength - 1,
        moveDelta: getHakoiriMusumePlayRecordMoveDelta(mismatched),
        timeDeltaMs: getHakoiriMusumePlayRecordTimeDelta(mismatched),
      });
      expect(restored?.result.score.total).toBe(
        getHakoiriMusumePlayRecordScore(mismatched),
      );
    });
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

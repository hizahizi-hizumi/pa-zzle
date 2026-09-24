import {
  createFifteenPuzzlePlayRecord,
  fifteenPuzzlePlayRecordDefinition,
  getFifteenPuzzlePlayRecordMoveDelta,
  getFifteenPuzzlePlayRecordScore,
  getFifteenPuzzlePlayRecordTimeDelta,
  isFifteenPuzzlePlayRecord,
} from "@/games/fifteen-puzzle/play-record";
import type { PlayRecord } from "@/records/play-record";

const record = createFifteenPuzzlePlayRecord({
  difficulty: "3",
  problemIdentity: {
    generatorVersion: "1",
    seed: "fp30-0",
    conditions: { size: 4, scrambleLength: 30 },
  },
  startedAt: 1_000,
  completedAt: 81_000,
  result: {
    elapsedMs: 80_000,
    moveCount: 42,
    completionMoveCount: 34,
    slideCount: 25,
    restartCount: 1,
    optimalMoveCount: 30,
  },
});

test("評価値を保存せず評価元の事実だけを保存用記録へ写すこと", () => {
  const performance = record.payload.performance;

  expect(record.id).toBe("fifteen-puzzle:1000:81000:fp30-0");
  expect(record.payloadVersion).toBe(1);
  expect(performance).toEqual({
    elapsedMs: 80_000,
    moveCount: 42,
    completionMoveCount: 34,
    slideCount: 25,
    restartCount: 1,
    optimalMoveCount: 30,
  });
  expect(Object.hasOwn(performance, "score")).toBe(false);
  expect(Object.hasOwn(performance, "moveDelta")).toBe(false);
});

test("保存した事実から現在のプレイ評価と比較指標を導出すること", () => {
  const score = getFifteenPuzzlePlayRecordScore(record);
  const timeDelta = getFifteenPuzzlePlayRecordTimeDelta(record);
  const moveDelta = getFifteenPuzzlePlayRecordMoveDelta(record);

  expect(score).toBe(77);
  expect(timeDelta).toBe(10_000);
  expect(moveDelta).toBe(12);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const comparisonKey =
    fifteenPuzzlePlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("3");
});

test("保存用記録を15パズルの記録として認めること", () => {
  const recognized = isFifteenPuzzlePlayRecord(record);

  expect(recognized).toBe(true);
});

describe("isFifteenPuzzlePlayRecord", () => {
  const invalidRecords: [string, PlayRecord][] = [
    ["別のゲーム", { ...record, gameId: "water-sort" }],
    ["未知の payload 版", { ...record, payloadVersion: 2 }],
    [
      "未知の難易度",
      { ...record, payload: { ...record.payload, difficulty: "6" } },
    ],
    [
      "別の盤面サイズ",
      {
        ...record,
        payload: {
          ...record.payload,
          problemIdentity: {
            ...record.payload.problemIdentity,
            conditions: { size: 5, scrambleLength: 30 },
          },
        },
      },
    ],
    [
      "総手数より多い完成時手数",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: {
            ...record.payload.performance,
            completionMoveCount: 43,
          },
        },
      },
    ],
    [
      "最短手数の欠落",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: {
            ...record.payload.performance,
            optimalMoveCount: null,
          },
        },
      },
    ],
  ];

  test.each(invalidRecords)(
    "不正な記録を認めないこと: %s",
    (_name, invalid) => {
      const recognized = isFifteenPuzzlePlayRecord(invalid);
      const score = getFifteenPuzzlePlayRecordScore(invalid);

      expect(recognized).toBe(false);
      expect(score).toBeNull();
    },
  );
});

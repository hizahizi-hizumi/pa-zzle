import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import {
  _private,
  createMagicSquarePlayRecord,
  isMagicSquarePlayRecord,
  magicSquarePlayRecordDefinition,
  restoreMagicSquareRecordedResult,
} from "@/games/magic-square/play-record";
import {
  listMagicSquarePoolEntries,
  toMagicSquarePoolIdentity,
} from "@/games/magic-square/problem/problem-pool";

const { getMagicSquarePlayRecordScore, getMagicSquarePlayRecordTimeDelta } =
  _private;

const problemIdentity = toMagicSquarePoolIdentity(
  listMagicSquarePoolEntries("1")[0]!,
);

// 基準時間は 20 + 8×10 = 100秒。
const workload = { emptyCellCount: 8 };

const performance = {
  elapsedMs: 120_000,
  withdrawalCount: 2,
  undoCount: 1,
  restartCount: 0,
};

const record = createMagicSquarePlayRecord({
  difficulty: "1",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 121_000,
  result: performance,
});

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createMagicSquarePlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { payload } = record;

    expect(payload).toEqual({
      difficulty: "1",
      problemIdentity,
      workload,
      performance,
    });
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });
});

describe("getMagicSquarePlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getMagicSquarePlayRecordScore(record);

    // 速さは 70 × (1 − 20/100) = 56点、正確さは 30 − 2×3 = 24点。
    expect(score).toBe(80);
  });
});

describe("getMagicSquarePlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getMagicSquarePlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(20_000);
  });
});

describe("isMagicSquarePlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({
        problemIdentity: {
          generatorVersion: "0",
          seed: "old",
          conditions: { size: 4 },
        },
      }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "nanpure" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    ["作業の量の無い記録", withPayload({ workload: undefined })],
    [
      "取り下げの回数が負の記録",
      withPayload({ performance: { ...performance, withdrawalCount: -1 } }),
    ],
    [
      "経過時間の無い記録",
      withPayload({ performance: { ...performance, elapsedMs: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%sを読み込むこと", (_, value) => {
    const valid = isMagicSquarePlayRecord(value);

    expect(valid).toBe(true);
  });

  test.each(invalidCases)("%sを読み込まないこと", (_, value) => {
    const valid = isMagicSquarePlayRecord(value);

    expect(valid).toBe(false);
  });
});

describe("restoreMagicSquareRecordedResult", () => {
  const otherVersionRecord = withPayload({
    problemIdentity: { generatorVersion: "0", seed: "old", conditions: {} },
  });

  test("今の版の記録から、プレイ中と同じ結果を作り直すこと", () => {
    const restored = restoreMagicSquareRecordedResult(record);

    expect({
      difficulty: restored?.difficulty,
      problemIdentity: restored?.problemIdentity,
      score: restored?.result.score.total,
      timeDeltaMs: restored?.result.timeDeltaMs,
      withdrawalCount: restored?.result.withdrawalCount,
    }).toEqual({
      difficulty: "1",
      problemIdentity,
      score: 80,
      timeDeltaMs: 20_000,
      withdrawalCount: 2,
    });
  });

  test("生成器の版が今と違う記録からは作り直さないこと", () => {
    const restored = restoreMagicSquareRecordedResult(otherVersionRecord);

    expect(restored).toBeNull();
  });
});

describe("magicSquarePlayRecordDefinition", () => {
  const cases = [
    ["play-score", 80],
    ["time-delta-ms", 20_000],
    ["withdrawal-count", 2],
  ] as const;

  test.each(cases)(
    "%s の指標を保存した事実から求めること",
    (metricId, expected) => {
      const value = getPlayRecordMetricValue(
        record,
        magicSquarePlayRecordDefinition,
        metricId,
      );

      expect(value).toBe(expected);
    },
  );

  test("難易度ごとに自己ベストを比べること", () => {
    const key = magicSquarePlayRecordDefinition.getComparisonKey(record);

    expect(key).toBe("1");
  });

  test("クリアの成績に経過時間だけを返すこと", () => {
    const performanceOfClear =
      magicSquarePlayRecordDefinition.getClearPerformance(record);

    expect(performanceOfClear).toEqual({ elapsedMs: 120_000 });
  });
});

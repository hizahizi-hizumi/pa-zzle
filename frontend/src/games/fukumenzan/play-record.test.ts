import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import { createFukumenzanResult } from "@/games/fukumenzan/play/use-fukumenzan-play";
import {
  createFukumenzanPlayRecord,
  fukumenzanPlayRecordDefinition,
  getFukumenzanPlayRecordScore,
  getFukumenzanPlayRecordTimeDelta,
  isFukumenzanPlayRecord,
  restoreFukumenzanRecordedResult,
} from "@/games/fukumenzan/play-record";
import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";

const problemIdentity = createFukumenzanProblemIdentity({
  addends: ["BYK", "KTK"],
  result: "TKHH",
});

// 基準時間は 20 + 5×15 + 10×1 = 105秒、0点は 315秒。
const workload = { letterCount: 5, letterCellCount: 10 };

// 速さは 100 × (1 − 21秒 / 210秒) = 90点。
const performance = {
  elapsedMs: 126_000,
  undoCount: 2,
  restartCount: 1,
  placeCount: 7,
  returnCount: 1,
  crossToggleCount: 12,
};
const expectedScore = 90;
const expectedTimeDeltaMs = 21_000;

const record = createFukumenzanPlayRecord({
  difficulty: "1",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 127_000,
  result: performance,
});

const olderProblemIdentity = {
  generatorVersion: "0",
  seed: "BYK+KTK=TKHH",
  conditions: {},
};

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createFukumenzanPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "fukumenzan:1000:127000:BYK+KTK=TKHH",
      gameId: "fukumenzan",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "1",
      problemIdentity,
      workload,
      performance,
    });
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });

  describe("評価を含む結果を渡した場合", () => {
    const recordFromResult = createFukumenzanPlayRecord({
      difficulty: "1",
      problemIdentity,
      workload,
      startedAt: 1_000,
      completedAt: 127_000,
      result: createFukumenzanResult(performance, workload),
    });

    test("評価を保存しないこと", () => {
      const { performance: savedPerformance } = recordFromResult.payload;

      expect(savedPerformance).toEqual(performance);
    });
  });
});

describe("getFukumenzanPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getFukumenzanPlayRecordScore(record);

    expect(score).toBe(expectedScore);
  });
});

describe("getFukumenzanPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getFukumenzanPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(expectedTimeDeltaMs);
  });
});

describe("isFukumenzanPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({ problemIdentity: olderProblemIdentity }),
    ],
    [
      "待ったの回数が盤面操作の回数と同じ記録",
      withPayload({ performance: { ...performance, undoCount: 20 } }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "bridges" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    [
      "式と合わない条件の identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { addendLengths: [3] },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "文字の種類が式の文字の数より多い作業の量",
      withPayload({ workload: { letterCount: 11, letterCellCount: 10 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "盤面操作の回数より多い待ったの回数",
      withPayload({ performance: { ...performance, undoCount: 21 } }),
    ],
    [
      "× の回数が無い記録",
      withPayload({
        performance: { ...performance, crossToggleCount: undefined },
      }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isFukumenzanPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isFukumenzanPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("fukumenzanPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey =
      fukumenzanPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("1");
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(
        record,
        fukumenzanPlayRecordDefinition,
        metricId,
      ),
    );

    expect(values).toEqual([expectedScore, expectedTimeDeltaMs]);
  });

  describe("読み込めない記録の場合", () => {
    const brokenRecord = withPayload({ workload: undefined });

    test("評価と自己ベストの値を持たないこと", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          brokenRecord,
          fukumenzanPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([null, null]);
    });
  });
});

describe("restoreFukumenzanRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreFukumenzanRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "1",
        problemIdentity,
        result: {
          ...performance,
          workload,
          speedRule: { fullScoreMs: 105_000, zeroScoreMs: 315_000 },
          timeDeltaMs: expectedTimeDeltaMs,
          score: { total: expectedScore, breakdown: { speed: expectedScore } },
        },
      });
    });
  });

  describe("読み戻した記録に余分な項目がある場合", () => {
    const recordWithExtra = withPayload({
      performance: { ...performance, guessedCount: 4 },
    });

    test("記録の項目だけで結果を作ること", () => {
      const recorded = restoreFukumenzanRecordedResult(recordWithExtra);

      expect(recorded?.result).not.toHaveProperty("guessedCount");
    });
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: olderProblemIdentity });

    test("結果を作らないこと", () => {
      const recorded = restoreFukumenzanRecordedResult(pastRecord);

      expect(recorded).toBeNull();
    });
  });
});

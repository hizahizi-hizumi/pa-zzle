import { createBridgesResult } from "@/games/bridges/play/use-bridges-play";
import {
  bridgesPlayRecordDefinition,
  createBridgesPlayRecord,
  getBridgesPlayRecordScore,
  getBridgesPlayRecordTimeDelta,
  isBridgesPlayRecord,
  restoreBridgesRecordedResult,
} from "@/games/bridges/play-record";
import { createBridgesProblemIdentity } from "@/games/bridges/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createBridgesProblemIdentity(
  {
    size: 10,
    islandDensity: 0.26,
    doubleBridgeRate: 0.65,
    extraBridgeRate: 0.25,
    splitRate: 0.45,
    refinementSteps: 500,
    refinementGoal: "lookahead",
  },
  16,
);

// 基準時間は 8 + 24×1 + 26×0.8 + 3×3 + 3×6 + 26×1 = 105.8秒。
const workload = {
  islandCount: 24,
  edgeCount: 32,
  bridgeCount: 26,
  countRoundCount: 3,
  connectivityRoundCount: 3,
  countReasoningUndecidedEdgeCount: 26,
};

// 速さは 100 × (1 − 23秒 / 211.6秒) ≒ 89点。
const performance = {
  elapsedMs: 128_800,
  undoCount: 2,
  restartCount: 1,
  inputCount: 40,
  blockedCount: 3,
};
const expectedScore = 89;
const expectedTimeDeltaMs = 23_000;

const record = createBridgesPlayRecord({
  difficulty: "5",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 129_800,
  result: performance,
});

/** 今の生成器より前の版（版 1。分割の生成条件を持たない）の identity。 */
const pastProblemIdentity = {
  generatorVersion: "1",
  seed: "br-10-d30-p10-e15-16",
  conditions: {
    size: 10,
    islandDensity: 0.3,
    doubleBridgeRate: 0.1,
    extraBridgeRate: 0.25,
  },
};

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createBridgesPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "bridges:1000:129800:br-10-d26-p65-e25-s45-r500-lookahead-16",
      gameId: "bridges",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "5",
      problemIdentity,
      workload,
      performance,
    });
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });

  describe("評価を含む結果を渡した場合", () => {
    const recordFromResult = createBridgesPlayRecord({
      difficulty: "5",
      problemIdentity,
      workload,
      startedAt: 1_000,
      completedAt: 129_800,
      result: createBridgesResult(performance, workload),
    });

    test("評価を保存しないこと", () => {
      const { performance: savedPerformance } = recordFromResult.payload;

      expect(savedPerformance).toEqual(performance);
    });
  });
});

describe("getBridgesPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getBridgesPlayRecordScore(record);

    expect(score).toBe(expectedScore);
  });
});

describe("getBridgesPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getBridgesPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(expectedTimeDeltaMs);
  });
});

describe("isBridgesPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({ problemIdentity: pastProblemIdentity }),
    ],
    [
      "待ったの回数が入力回数と同じ記録",
      withPayload({ performance: { ...performance, undoCount: 40 } }),
    ],
    [
      "作業の量に1手の先読みの回数がある記録",
      withPayload({ workload: { ...workload, lookaheadRoundCount: 1 } }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "reflection" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    [
      "生成器の版が無い identity",
      withPayload({
        problemIdentity: { ...problemIdentity, generatorVersion: "" },
      }),
    ],
    [
      "今の生成器の版で扱えない生成条件の identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { ...problemIdentity.conditions, splitRate: 0.5 },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "島が無い作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, islandCount: 0 },
      }),
    ],
    [
      "整数でない読みの回数",
      withPayload({ workload: { ...workload, countRoundCount: 1.5 } }),
    ],
    [
      "島の数が identity の盤面のマスの数を超える作業の量",
      withPayload({
        workload: {
          ...workload,
          islandCount: 101,
          edgeCount: 120,
          bridgeCount: 120,
        },
      }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "入力回数より多い待ったの回数",
      withPayload({ performance: { ...performance, undoCount: 41 } }),
    ],
    [
      "交わる橋に阻まれた回数が無い記録",
      withPayload({ performance: { ...performance, blockedCount: undefined } }),
    ],
    [
      "盤面を戻した回数が無い記録",
      withPayload({ performance: { ...performance, restartCount: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isBridgesPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isBridgesPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("bridgesPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey = bridgesPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("5");
  });

  test("自己ベストを評価点は高いほど、基準時間との差は小さいほど良いとして比べること", () => {
    const directions = bridgesPlayRecordDefinition.personalBestMetrics.map(
      ({ id, direction }) => [id, direction],
    );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(record, bridgesPlayRecordDefinition, metricId),
    );

    expect(values).toEqual([expectedScore, expectedTimeDeltaMs]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: pastProblemIdentity });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          bridgesPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([expectedScore, expectedTimeDeltaMs]);
    });
  });

  describe("読み込めない記録の場合", () => {
    const brokenRecord = withPayload({ workload: undefined });

    test("評価と自己ベストの値を持たないこと", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          brokenRecord,
          bridgesPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([null, null]);
    });
  });
});

describe("restoreBridgesRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreBridgesRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "5",
        problemIdentity,
        result: {
          ...performance,
          workload,
          speedRule: { fullScoreMs: 105_800, zeroScoreMs: 317_400 },
          timeDeltaMs: expectedTimeDeltaMs,
          score: { total: expectedScore, breakdown: { speed: expectedScore } },
        },
      });
    });
  });

  describe("読み戻した記録に余分な項目がある場合", () => {
    const recordWithExtra = withPayload({
      performance: { ...performance, retractedCount: 4 },
    });

    test("記録の項目だけで結果を作ること", () => {
      const recorded = restoreBridgesRecordedResult(recordWithExtra);

      expect(recorded?.result).not.toHaveProperty("retractedCount");
    });
  });

  describe("今の版でない記録の場合", () => {
    const unrestorableRecords = [
      ["別の payload の版の記録", { ...record, payloadVersion: 2 }],
      [
        "生成器の版が今と違う記録",
        withPayload({ problemIdentity: pastProblemIdentity }),
      ],
    ] as const;

    test.each(unrestorableRecords)("%s から結果を作らないこと", (_, value) => {
      const recorded = restoreBridgesRecordedResult(value);

      expect(recorded).toBeNull();
    });
  });
});

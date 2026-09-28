import {
  createReflectionPlayRecord,
  getReflectionPlayRecordScore,
  getReflectionPlayRecordTimeDelta,
  isReflectionPlayRecord,
  reflectionPlayRecordDefinition,
} from "@/games/reflection/play-record";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createReflectionProblemIdentity(6, 11, 3);

// 基準時間は 24×0.5 + 11×6 + 15×8 + 8×15 = 318秒。
const workload = {
  pieceCount: 11,
  clueCount: 24,
  propagationRoundCount: 15,
  assumptionTestCount: 8,
};

const performance = {
  elapsedMs: 400_000,
  relocationCount: 2,
  restartCount: 0,
  laserCheckCount: 12,
  inputCount: 30,
};

const record = createReflectionPlayRecord({
  difficulty: "5",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 401_000,
  result: performance,
});

// 今の生成器の版でない identity は生成条件を確かめないので、作業の量の形だけを確かめられる。
const pastProblemIdentity = {
  generatorVersion: "1",
  seed: "rf-old",
  conditions: { size: 6 },
};

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createReflectionPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "reflection:1000:401000:rf-6-11-3",
      gameId: "reflection",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "5",
      problemIdentity: {
        generatorVersion: "2",
        seed: "rf-6-11-3",
        conditions: { size: 6, pieceCount: 11 },
      },
      workload,
      performance,
    });
    expect(Object.hasOwn(payload, "poolReference")).toBe(false);
    expect(Object.hasOwn(payload.performance, "score")).toBe(false);
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });
});

describe("getReflectionPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getReflectionPlayRecordScore(record);

    expect(score).toBe(87);
  });
});

describe("getReflectionPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getReflectionPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(82_000);
  });
});

describe("isReflectionPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({
        problemIdentity: {
          generatorVersion: "1",
          seed: "rf-6-11-3",
          conditions: { size: 6, pieceCount: 11 },
        },
      }),
    ],
    [
      "評価に使わない undoCount を持つ以前の記録",
      withPayload({ performance: { ...performance, undoCount: 1 } }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "takuzu" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    [
      "生成器の版が無い identity",
      withPayload({
        problemIdentity: { ...problemIdentity, generatorVersion: "" },
      }),
    ],
    [
      "今の生成器の版で扱えない盤面サイズの identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { size: 12, pieceCount: 11 },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "外周ヒントの本数が4の倍数でない作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, clueCount: 25 },
      }),
    ],
    [
      "ピースが盤面を埋める作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, pieceCount: 36 },
      }),
    ],
    [
      "identity とピース数が食い違う作業の量",
      withPayload({ workload: { ...workload, pieceCount: 10 } }),
    ],
    [
      "identity と盤面サイズが食い違う作業の量",
      withPayload({ workload: { ...workload, clueCount: 28 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "整数でない置き直し回数",
      withPayload({ performance: { ...performance, relocationCount: 1.5 } }),
    ],
    [
      "入力回数より多い置き直し回数",
      withPayload({ performance: { ...performance, relocationCount: 31 } }),
    ],
    [
      "光路を確かめた回数が無い記録",
      withPayload({
        performance: { ...performance, laserCheckCount: undefined },
      }),
    ],
    [
      "盤面を戻した回数が無い記録",
      withPayload({ performance: { ...performance, restartCount: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isReflectionPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isReflectionPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("reflectionPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey =
      reflectionPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("5");
  });

  test("自己ベストを評価点は高いほど、基準時間との差は小さいほど良いとして比べ、点に入らない置き直し回数は比べないこと", () => {
    const directions = reflectionPlayRecordDefinition.personalBestMetrics.map(
      ({ id, direction }) => [id, direction],
    );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(
        record,
        reflectionPlayRecordDefinition,
        metricId,
      ),
    );

    expect(values).toEqual([87, 82_000]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: pastProblemIdentity });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          reflectionPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([87, 82_000]);
    });
  });
});

import {
  createTsumeShogiPlayRecord,
  getTsumeShogiPlayRecordScore,
  getTsumeShogiPlayRecordTimeDelta,
  isTsumeShogiPlayRecord,
  restoreTsumeShogiRecordedResult,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import { createTsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createTsumeShogiProblemIdentity(5, 50, {
  minimum: 10,
  maximum: 99,
});
const poolReference = { poolVersion: "2", problemId: "5-17" };

// 基準時間は 8 + 攻方3手 × 4 + 王手12 × 2 + もっともらしい誤王手13 × 4 + 深い紛れ8 × 6 = 144秒。
const workload = {
  plies: 5,
  rootChecks: 12,
  plausibleWrong: 13,
  deepDecoyCount: 8,
};

// 基準時間の1.2倍（速さ72点）で、誤王手1回（読みの確かさ15点）。
const performance = {
  elapsedMs: 172_800,
  wrongCheckCount: 1,
  refutationViewCount: 2,
  returnCount: 1,
  undoCount: 1,
  restartCount: 0,
  illegalInputCount: 3,
  inputCount: 20,
};

const record = createTsumeShogiPlayRecord({
  difficulty: "5",
  problemIdentity,
  poolReference,
  workload,
  startedAt: 1_000,
  completedAt: 173_800,
  result: performance,
});

// 今の生成器の版でない identity は生成条件を確かめないので、作業の量の形だけを確かめられる。
const pastProblemIdentity = {
  generatorVersion: "0",
  seed: "ts-old",
  conditions: { depth: 5 },
};

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createTsumeShogiPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "tsume-shogi:1000:173800:ts-5-c10-99-50",
      gameId: "tsume-shogi",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "5",
      problemIdentity: {
        generatorVersion: "2",
        seed: "ts-5-c10-99-50",
        conditions: { plies: 5, rootChecks: { minimum: 10, maximum: 99 } },
      },
      poolReference,
      workload,
      performance,
    });
    expect(Object.hasOwn(payload.performance, "score")).toBe(false);
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });

  test("初手の王手の数の範囲の無い identity では生成条件に範囲を書かないこと", () => {
    const { payload } = createTsumeShogiPlayRecord({
      difficulty: "1",
      problemIdentity: createTsumeShogiProblemIdentity(3, 0),
      poolReference,
      workload: {
        plies: 3,
        rootChecks: 3,
        plausibleWrong: 0,
        deepDecoyCount: 0,
      },
      startedAt: 1_000,
      completedAt: 20_000,
      result: performance,
    });

    expect(payload.problemIdentity.conditions).toEqual({ plies: 3 });
  });
});

describe("getTsumeShogiPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getTsumeShogiPlayRecordScore(record);

    expect(score).toBe(87);
  });
});

describe("getTsumeShogiPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getTsumeShogiPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(28_800);
  });
});

describe("isTsumeShogiPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({ problemIdentity: pastProblemIdentity }),
    ],
    [
      "同じ誤王手を指し直して、誤王手より多く判断地点へ戻った記録",
      withPayload({ performance: { ...performance, returnCount: 2 } }),
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
      "今の生成器の版で扱えない手数の identity",
      withPayload({
        problemIdentity: { ...problemIdentity, conditions: { plies: 7 } },
      }),
    ],
    ["問題集の位置が無い記録", withPayload({ poolReference: undefined })],
    [
      "問題番号が空の記録",
      withPayload({ poolReference: { poolVersion: "2", problemId: "" } }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "偶数の手数の作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, plies: 4 },
      }),
    ],
    [
      "identity と手数が食い違う作業の量",
      withPayload({ workload: { ...workload, plies: 3 } }),
    ],
    [
      "identity の初手の王手の範囲から外れる作業の量",
      withPayload({ workload: { ...workload, rootChecks: 9 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "整数でない誤王手の回数",
      withPayload({ performance: { ...performance, wrongCheckCount: 1.5 } }),
    ],
    [
      "誤王手と非合法入力が入力回数より多い記録",
      withPayload({
        performance: { ...performance, illegalInputCount: 20 },
      }),
    ],
    [
      "誤王手が無いのに判断地点へ戻った記録",
      withPayload({
        performance: { ...performance, wrongCheckCount: 0, returnCount: 1 },
      }),
    ],
    [
      "反証を見た回数が無い記録",
      withPayload({
        performance: { ...performance, refutationViewCount: undefined },
      }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isTsumeShogiPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isTsumeShogiPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("tsumeShogiPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms", "wrong-check-count"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey =
      tsumeShogiPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("5");
  });

  test("自己ベストを評価点は高いほど、基準時間との差と誤王手の回数は小さいほど良いとして比べること", () => {
    const directions = tsumeShogiPlayRecordDefinition.personalBestMetrics.map(
      ({ id, direction }) => [id, direction],
    );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
      ["wrong-check-count", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(
        record,
        tsumeShogiPlayRecordDefinition,
        metricId,
      ),
    );

    expect(values).toEqual([87, 28_800, 1]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: pastProblemIdentity });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          tsumeShogiPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([87, 28_800, 1]);
    });
  });
});

describe("restoreTsumeShogiRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreTsumeShogiRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "5",
        problemIdentity: record.payload.problemIdentity,
        result: {
          ...performance,
          workload,
          speedFullScoreMs: 144_000,
          timeDeltaMs: 28_800,
          score: { total: getTsumeShogiPlayRecordScore(record) },
        },
      });
    });
  });

  describe("別の版の記録の場合", () => {
    const unrestorableRecord = { ...record, payloadVersion: 2 };

    test("null を返すこと", () => {
      const recorded = restoreTsumeShogiRecordedResult(unrestorableRecord);

      expect(recorded).toBeNull();
    });
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: pastProblemIdentity });

    test("null を返すこと", () => {
      const recorded = restoreTsumeShogiRecordedResult(pastRecord);

      expect(recorded).toBeNull();
    });
  });
});

import {
  createNonogramPlayRecord,
  getNonogramPlayRecordScore,
  getNonogramPlayRecordTimeDelta,
  isNonogramPlayRecord,
  nonogramPlayRecordDefinition,
  restoreNonogramRecordedResult,
} from "@/games/nonogram/play-record";
import {
  createNonogramProblemIdentity,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createNonogramProblemIdentity(
  { width: 10, height: 10 },
  nonogramPatternStyles[0]!,
  3,
);

// 基準時間は 10 + 20×2 + 50×0.75 + 10×5 = 137.5秒。
const workload = {
  width: 10,
  height: 10,
  filledCellCount: 50,
  roundCount: 10,
};

const performance = {
  elapsedMs: 160_000,
  repaintCount: 1,
  crossToggleCount: 12,
  undoCount: 2,
  restartCount: 1,
  inputCount: 70,
};

const record = createNonogramPlayRecord({
  difficulty: "4",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 161_000,
  result: performance,
});

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createNonogramPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { payload } = record;

    expect(payload).toEqual({
      difficulty: "4",
      problemIdentity: {
        generatorVersion: "1",
        seed: "ng-10x10-d0.45-s0-m-3",
        conditions: {
          width: 10,
          height: 10,
          blackProbability: 0.45,
          smoothingCount: 0,
          mirrored: true,
        },
      },
      workload,
      performance,
    });
    expect(Object.hasOwn(payload.performance, "score")).toBe(false);
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });
});

describe("getNonogramPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getNonogramPlayRecordScore(record);

    expect(score).toBe(90);
  });
});

describe("getNonogramPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getNonogramPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(22_500);
  });
});

describe("isNonogramPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({
        problemIdentity: {
          generatorVersion: "0",
          seed: "ng-old",
          conditions: { width: 15, height: 15 },
        },
      }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "takuzu" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    [
      "今の生成器の版で扱わない盤面の大きさの identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { ...problemIdentity.conditions, width: 15 },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "塗るマスが盤面より多い作業の量",
      withPayload({ workload: { ...workload, filledCellCount: 101 } }),
    ],
    [
      "連鎖の段が無い作業の量",
      withPayload({ workload: { ...workload, roundCount: 0 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "整数でない塗り直しの数",
      withPayload({ performance: { ...performance, repaintCount: 1.5 } }),
    ],
    [
      "× を付け外したマスの数が無い記録",
      withPayload({
        performance: { ...performance, crossToggleCount: undefined },
      }),
    ],
    [
      "入力の回数より多い待ったの回数",
      withPayload({ performance: { ...performance, undoCount: 71 } }),
    ],
    [
      "盤面を戻した回数が無い記録",
      withPayload({ performance: { ...performance, restartCount: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isNonogramPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isNonogramPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("nonogramPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms", "repaint-count"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey = nonogramPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("4");
  });

  test("自己ベストを評価点は高いほど、基準時間との差と塗り直しの数は小さいほど良いとして比べること", () => {
    const directions = nonogramPlayRecordDefinition.personalBestMetrics.map(
      ({ id, direction }) => [id, direction],
    );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
      ["repaint-count", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(record, nonogramPlayRecordDefinition, metricId),
    );

    expect(values).toEqual([90, 22_500, 1]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({
      problemIdentity: {
        generatorVersion: "0",
        seed: "ng-old",
        conditions: { width: 15, height: 15 },
      },
    });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          nonogramPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([90, 22_500, 1]);
    });
  });
});

describe("restoreNonogramRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreNonogramRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "4",
        problemIdentity,
        result: {
          ...performance,
          workload,
          timeDeltaMs: 22_500,
          score: { total: getNonogramPlayRecordScore(record) },
        },
      });
    });
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({
      problemIdentity: {
        generatorVersion: "0",
        seed: "ng-old",
        conditions: { width: 15, height: 15 },
      },
    });

    test("null を返すこと", () => {
      const recorded = restoreNonogramRecordedResult(pastRecord);

      expect(recorded).toBeNull();
    });
  });
});

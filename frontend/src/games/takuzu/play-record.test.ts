import {
  createTakuzuPlayRecord,
  getTakuzuPlayRecordScore,
  getTakuzuPlayRecordTimeDelta,
  isTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createTakuzuProblemIdentity(
  "duplicate-avoidance",
  2,
  160,
);

// 基準時間は 10 + 46×2 + 18×3 + 2×10 = 176秒。
const workload = {
  emptyCellCount: 46,
  roundCount: 18,
  lineReadingRoundCount: 2,
};

const performance = {
  elapsedMs: 220_000,
  correctionCount: 1,
  restartCount: 0,
  undoCount: 1,
  inputCount: 70,
};

const record = createTakuzuPlayRecord({
  difficulty: "4",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 221_000,
  result: performance,
});

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createTakuzuPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { payload } = record;

    expect(payload).toEqual({
      difficulty: "4",
      problemIdentity: {
        generatorVersion: "1",
        seed: "tk-duplicate-avoidance-2-160",
        conditions: {
          size: 8,
          removalTechniqueLimit: "duplicate-avoidance",
          extraGivenCount: 2,
        },
      },
      workload,
      performance,
    });
    expect(Object.hasOwn(payload.performance, "score")).toBe(false);
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });
});

describe("getTakuzuPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getTakuzuPlayRecordScore(record);

    expect(score).toBe(83);
  });
});

describe("待ったの回数が無い記録の場合", () => {
  const recordWithoutUndo = withPayload({
    performance: { ...performance, undoCount: undefined },
  });

  test("待った0回として評価を導出すること", () => {
    const score = getTakuzuPlayRecordScore(recordWithoutUndo);

    expect(score).toBe(85);
  });
});

describe("getTakuzuPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getTakuzuPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(44_000);
  });
});

describe("isTakuzuPlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "待ったの回数が無い記録",
      withPayload({ performance: { ...performance, undoCount: undefined } }),
    ],
    [
      "生成器の版が今と違う記録",
      withPayload({
        problemIdentity: {
          generatorVersion: "0",
          seed: "tk-old",
          conditions: { size: 8, removalLimit: "D" },
        },
      }),
    ],
  ] as const;

  const invalidCases = [
    ["別のゲームの記録", { ...record, gameId: "nanpure" }],
    ["未知の payload の版", { ...record, payloadVersion: 2 }],
    ["未知の難易度", withPayload({ difficulty: "6" })],
    [
      "生成器の版が無い identity",
      withPayload({
        problemIdentity: { ...problemIdentity, generatorVersion: "" },
      }),
    ],
    [
      "今の生成器の版で盤面の大きさが違う identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { ...problemIdentity.conditions, size: 6 },
        },
      }),
    ],
    [
      "今の生成器の版で未知の手筋の identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: {
            ...problemIdentity.conditions,
            removalTechniqueLimit: "guess",
          },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "局面の数より行・列を読む局面が多い作業の量",
      withPayload({ workload: { ...workload, lineReadingRoundCount: 19 } }),
    ],
    [
      "空きマスが盤面より多い作業の量",
      withPayload({ workload: { ...workload, emptyCellCount: 65 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "整数でない置き直し回数",
      withPayload({ performance: { ...performance, correctionCount: 1.5 } }),
    ],
    [
      "入力回数より多い置き直し回数",
      withPayload({ performance: { ...performance, correctionCount: 71 } }),
    ],
    [
      "整数でない待った回数",
      withPayload({ performance: { ...performance, undoCount: 0.5 } }),
    ],
    [
      "入力回数より多い待った回数",
      withPayload({ performance: { ...performance, undoCount: 71 } }),
    ],
    [
      "盤面を戻した回数が無い記録",
      withPayload({ performance: { ...performance, restartCount: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isTakuzuPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isTakuzuPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("takuzuPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms", "correction-count"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey = takuzuPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("4");
  });

  test("自己ベストを評価点は高いほど、基準時間との差と置き直し回数は小さいほど良いとして比べること", () => {
    const directions = takuzuPlayRecordDefinition.personalBestMetrics.map(
      ({ id, direction }) => [id, direction],
    );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
      ["correction-count", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(record, takuzuPlayRecordDefinition, metricId),
    );

    expect(values).toEqual([83, 44_000, 1]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({
      problemIdentity: {
        generatorVersion: "0",
        seed: "tk-old",
        conditions: { size: 8 },
      },
    });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          takuzuPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([83, 44_000, 1]);
    });
  });
});

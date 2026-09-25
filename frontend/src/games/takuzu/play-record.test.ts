import {
  createTakuzuPlayRecord,
  getTakuzuPlayRecordScore,
  getTakuzuPlayRecordTimeDeltaMs,
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

function createRecord() {
  return createTakuzuPlayRecord({
    difficulty: "4",
    problemIdentity,
    workload,
    startedAt: 1_000,
    completedAt: 221_000,
    result: {
      elapsedMs: 220_000,
      correctionCount: 1,
      restartCount: 0,
      inputCount: 70,
    },
  });
}

function withPayload(overrides: Record<string, unknown>) {
  const record = createRecord();
  return { ...record, payload: { ...record.payload, ...overrides } };
}

test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
  const record = createRecord();

  expect(record.payload).toEqual({
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
    performance: {
      elapsedMs: 220_000,
      correctionCount: 1,
      restartCount: 0,
      inputCount: 70,
    },
  });
  expect(Object.hasOwn(record.payload.performance, "score")).toBe(false);
  expect(record.payload.problemIdentity).not.toBe(problemIdentity);
});

test("保存した事実から現在のプレイ評価と基準時間との差を導出すること", () => {
  const record = createRecord();

  expect(getTakuzuPlayRecordScore(record)).toBe(85);
  expect(getTakuzuPlayRecordTimeDeltaMs(record)).toBe(44_000);
});

test("作成した記録を妥当な記録として読み戻せること", () => {
  expect(isTakuzuPlayRecord(createRecord())).toBe(true);
});

test.each([
  ["別のゲームの記録", { ...createRecord(), gameId: "nanpure" }],
  ["未知の payload の版", { ...createRecord(), payloadVersion: 2 }],
  ["未知の難易度", withPayload({ difficulty: "6" })],
  [
    "生成器の版が違う identity",
    withPayload({
      problemIdentity: { ...problemIdentity, generatorVersion: "0" },
    }),
  ],
  [
    "盤面の大きさが違う identity",
    withPayload({
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions, size: 6 },
      },
    }),
  ],
  [
    "未知の手筋の identity",
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
    withPayload({
      workload: { ...workload, lineReadingRoundCount: 19 },
    }),
  ],
  [
    "空きマスが盤面より多い作業の量",
    withPayload({ workload: { ...workload, emptyCellCount: 65 } }),
  ],
  [
    "負の経過時間",
    withPayload({
      performance: { ...createRecord().payload.performance, elapsedMs: -1 },
    }),
  ],
  [
    "整数でない置き直し回数",
    withPayload({
      performance: {
        ...createRecord().payload.performance,
        correctionCount: 1.5,
      },
    }),
  ],
  [
    "入力回数より多い置き直し回数",
    withPayload({
      performance: {
        ...createRecord().payload.performance,
        correctionCount: 71,
      },
    }),
  ],
  [
    "やり直し回数が無い記録",
    withPayload({
      performance: {
        ...createRecord().payload.performance,
        restartCount: undefined,
      },
    }),
  ],
])("%s を読み込まないこと", (_, record) => {
  expect(isTakuzuPlayRecord(record)).toBe(false);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  expect(takuzuPlayRecordDefinition.getComparisonKey(createRecord())).toBe("4");
});

test("自己ベストを評価点・基準時間との差・置き直し回数で比べること", () => {
  const record = createRecord();

  expect(
    takuzuPlayRecordDefinition.personalBestMetrics.map(({ id, direction }) => [
      id,
      direction,
    ]),
  ).toEqual([
    ["play-score", "higher"],
    ["time-delta-ms", "lower"],
    ["correction-count", "lower"],
  ]);
  expect(
    getPlayRecordMetricValue(record, takuzuPlayRecordDefinition, "play-score"),
  ).toBe(85);
  expect(
    getPlayRecordMetricValue(
      record,
      takuzuPlayRecordDefinition,
      "time-delta-ms",
    ),
  ).toBe(44_000);
  expect(
    getPlayRecordMetricValue(
      record,
      takuzuPlayRecordDefinition,
      "correction-count",
    ),
  ).toBe(1);
});

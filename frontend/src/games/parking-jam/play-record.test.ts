import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import {
  createParkingJamPlayRecord,
  getParkingJamPlayRecordScore,
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import { PARKING_JAM_SCORE_MODEL_VERSION } from "@/games/parking-jam/score";
import type { PlayRecord } from "@/records/play-record";

const problemIdentity = {
  generatorVersion: "2",
  seed: "record-seed",
  conditions: {
    width: 8,
    height: 8,
    vehicleCount: 14,
    roadOpeningCount: 4,
    roadOpeningSpan: 2,
    fixedAreaCount: 2,
    fixedAreaLength: 2,
    blockingPlacementProbability: 0,
  },
  generationAttempt: 2,
} as const;

const performance = {
  elapsedMs: 90_000,
  moveAttemptCount: 16,
  successfulMoveCount: 15,
  failedMoveCount: 1,
  undoCount: 1,
  restartCount: 0,
};

const record = createParkingJamPlayRecord({
  difficulty: "3",
  problemIdentity,
  speedReference: { vehicleCount: 14, initialBlockedVehicleCount: 6 },
  startedAt: 1_000,
  completedAt: 91_000,
  result: performance,
});

const legacyRecord: PlayRecord = {
  id: "parking-jam-legacy",
  gameId: "parking-jam",
  startedAt: 1_000,
  completedAt: 91_000,
  payloadVersion: 2,
  payload: { difficulty: "normal", problemIdentity, performance },
};
const legacyPayload = { difficulty: "normal", problemIdentity, performance };

const threeLevelPayload = {
  difficulty: "hard",
  difficultyModelVersion: "visual-local-load-v1",
  scoreModelVersion: PARKING_JAM_SCORE_MODEL_VERSION,
  problemIdentity,
  problemFacts: { initialBlockedVehicleCount: 6 },
  performance,
};
const threeLevelRecord: PlayRecord = {
  id: "parking-jam-three-level",
  gameId: "parking-jam",
  startedAt: 1_000,
  completedAt: 91_000,
  payloadVersion: 3,
  payload: threeLevelPayload,
};

describe("createParkingJamPlayRecord", () => {
  test("問題を分類した難易度モデル版と採点版を保存すること", () => {
    const { difficultyModelVersion, scoreModelVersion } = record.payload;

    expect(difficultyModelVersion).toBe(PARKING_JAM_DIFFICULTY_MODEL_VERSION);
    expect(scoreModelVersion).toBe(PARKING_JAM_SCORE_MODEL_VERSION);
  });

  test("レベル1〜5の難易度を payloadVersion 4 で保存すること", () => {
    const { payloadVersion, payload } = record;

    expect(payloadVersion).toBe(4);
    expect(payload.difficulty).toBe("3");
  });
});

describe("isParkingJamPlayRecord", () => {
  const recognizedCases = [
    ["待ったで戻した車を再び出庫した現在の形式", record],
    ["難易度モデル版と採点版を持たない payloadVersion 2", legacyRecord],
    ["3段階の難易度で分類した payloadVersion 3", threeLevelRecord],
  ] as const;

  test.each(recognizedCases)(
    "保存したプレイ事実をパーキングジャム記録として認識すること: %s",
    (_label, candidate) => {
      const recognized = isParkingJamPlayRecord(candidate);

      expect(recognized).toBe(true);
    },
  );

  const invalidCases = [
    [
      "総操作数と成功・不成立操作数が一致しない",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: { ...performance, moveAttemptCount: 99 },
        },
      },
    ],
    [
      "全車の出庫に満たない",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: {
            ...performance,
            moveAttemptCount: 14,
            successfulMoveCount: 13,
          },
        },
      },
    ],
    [
      "採点版が不明",
      {
        ...record,
        payload: { ...record.payload, scoreModelVersion: "unknown" },
      },
    ],
    [
      "payloadVersion 4 なのに3段階の難易度",
      { ...record, payload: { ...record.payload, difficulty: "normal" } },
    ],
    [
      "payloadVersion 3 なのにレベルの難易度",
      {
        ...threeLevelRecord,
        payload: { ...threeLevelPayload, difficulty: "3" },
      },
    ],
    [
      "payloadVersion 2 なのにレベルの難易度",
      { ...legacyRecord, payload: { ...legacyPayload, difficulty: "1" } },
    ],
    [
      "初期に塞がれた車が車両数以上",
      {
        ...record,
        payload: {
          ...record.payload,
          problemFacts: { initialBlockedVehicleCount: 14 },
        },
      },
    ],
  ] as const satisfies readonly (readonly [string, PlayRecord])[];

  test.each(invalidCases)(
    "不整合な記録を認識しないこと: %s",
    (_label, candidate) => {
      const recognized = isParkingJamPlayRecord(candidate);

      expect(recognized).toBe(false);
    },
  );
});

describe("getParkingJamPlayRecordScore", () => {
  const cases = [
    ["現在の形式は問題ごとの基準時間65秒で採点する", record, 78],
    [
      "payloadVersion 2 は当時の難易度別基準時間90秒で採点する",
      legacyRecord,
      93,
    ],
    [
      "payloadVersion 3 は現在と同じ問題ごとの基準時間65秒で採点する",
      threeLevelRecord,
      78,
    ],
  ] as const;

  test.each(cases)(
    "保存済み事実から記録の採点版で評価点を再計算すること: %s",
    (_label, candidate, expected) => {
      if (!isParkingJamPlayRecord(candidate)) {
        throw new Error("Expected a parking jam record");
      }

      const score = getParkingJamPlayRecordScore(candidate);

      expect(score).toBe(expected);
    },
  );
});

describe("parkingJamPlayRecordDefinition", () => {
  const comparisonCases = [
    ["レベル1〜5の記録はレベル", record, "3"],
    ["3段階の記録は旧区分", threeLevelRecord, "hard"],
    ["payloadVersion 2 の記録は旧区分", legacyRecord, "normal"],
  ] as const;

  test.each(comparisonCases)(
    "難易度ごとに比較し旧3段階を新レベルと混ぜないこと: %s",
    (_label, candidate, expected) => {
      const comparisonKey =
        parkingJamPlayRecordDefinition.getComparisonKey(candidate);

      expect(comparisonKey).toBe(expected);
    },
  );

  test("スコア・時間・不成立操作数を自己ベスト指標にすること", () => {
    const metricIds = parkingJamPlayRecordDefinition.personalBestMetrics.map(
      (metric) => metric.id,
    );

    expect(metricIds).toEqual([
      "play-score",
      "elapsed-ms",
      "failed-move-count",
    ]);
  });
});

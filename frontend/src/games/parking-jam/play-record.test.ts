import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import {
  createParkingJamPlayRecord,
  getParkingJamPlayRecordScore,
  getParkingJamPlayRecordTimeDelta,
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
  restoreParkingJamRecordedResult,
} from "@/games/parking-jam/play-record";
import {
  calculateParkingJamSpeedScoreRule,
  PARKING_JAM_SCORE_MODEL_VERSION,
} from "@/games/parking-jam/score";
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
    ["現在の形式", record],
    ["payloadVersion 3", threeLevelRecord],
  ] as const;

  test.each(cases)(
    "保存済み事実から問題ごとの基準時間65秒で評価点を再計算すること: %s",
    (_label, candidate) => {
      const score = getParkingJamPlayRecordScore(candidate);

      expect(score).toBe(78);
    },
  );

  describe("基準時間を求める問題の事実を持たない payloadVersion 2 の記録の場合", () => {
    test("評価点を推測しないこと", () => {
      const score = getParkingJamPlayRecordScore(legacyRecord);

      expect(score).toBeNull();
    });
  });
});

describe("getParkingJamPlayRecordTimeDelta", () => {
  test("問題ごとの基準時間65秒との差を求めること", () => {
    const timeDelta = getParkingJamPlayRecordTimeDelta(record);

    expect(timeDelta).toBe(25_000);
  });

  describe("基準時間を求める問題の事実を持たない payloadVersion 2 の記録の場合", () => {
    test("基準時間との差を推測しないこと", () => {
      const timeDelta = getParkingJamPlayRecordTimeDelta(legacyRecord);

      expect(timeDelta).toBeNull();
    });
  });
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

  test("スコア・基準時間との差・不成立操作数を自己ベスト指標にすること", () => {
    const metricIds = parkingJamPlayRecordDefinition.personalBestMetrics.map(
      (metric) => metric.id,
    );

    expect(metricIds).toEqual([
      "play-score",
      "time-delta-ms",
      "failed-move-count",
    ]);
  });

  describe("payloadVersion 2 の記録の場合", () => {
    test("自己ベストの比較に使う値を持たないこと", () => {
      const values = parkingJamPlayRecordDefinition.personalBestMetrics.map(
        (metric) => metric.getValue(legacyRecord),
      );

      expect(values).toEqual([null, null, null]);
    });
  });
});

describe("restoreParkingJamRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    const speedReference = { vehicleCount: 14, initialBlockedVehicleCount: 6 };

    test("記録の成績と問題の事実から結果を作り直すこと", () => {
      const recorded = restoreParkingJamRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "3",
        problemIdentity,
        result: {
          ...performance,
          speedReference,
          speedRule: calculateParkingJamSpeedScoreRule(speedReference),
          timeDeltaMs: getParkingJamPlayRecordTimeDelta(record),
          score: { total: getParkingJamPlayRecordScore(record) },
        },
      });
    });
  });

  describe("3段階の難易度の記録の場合", () => {
    const unrestorableRecord = threeLevelRecord;

    test("null を返すこと", () => {
      const recorded = restoreParkingJamRecordedResult(unrestorableRecord);

      expect(recorded).toBeNull();
    });
  });
});

describe("生成器の版が今と違う記録の場合", () => {
  const olderRecord: PlayRecord = {
    ...record,
    payload: {
      ...record.payload,
      problemIdentity: {
        generatorVersion: "1",
        seed: "older-generator-seed",
        conditions: { vehicleCount: 14 },
      },
    },
  };

  test("記録として読み込み、今の評価規則で評価すること", () => {
    const accepted = isParkingJamPlayRecord(olderRecord);
    const score = isParkingJamPlayRecord(olderRecord)
      ? getParkingJamPlayRecordScore(olderRecord)
      : null;

    expect(accepted).toBe(true);
    expect(score).toBe(getParkingJamPlayRecordScore(record));
  });

  test("結果画面に出す内容を作り直さないこと", () => {
    const restored = restoreParkingJamRecordedResult(olderRecord);

    expect(restored).toBeNull();
  });
});

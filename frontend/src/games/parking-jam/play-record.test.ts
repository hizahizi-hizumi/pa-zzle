import type { PlayRecord } from "@/records/play-record";
import {
  createParkingJamPlayRecord,
  getParkingJamPlayRecordScore,
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "./play-record";

const record = createParkingJamPlayRecord({
  difficulty: "normal",
  problemIdentity: {
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
  },
  startedAt: 1_000,
  completedAt: 91_000,
  result: {
    elapsedMs: 90_000,
    moveAttemptCount: 15,
    successfulMoveCount: 14,
    failedMoveCount: 1,
    undoCount: 1,
    restartCount: 0,
  },
});

describe("isParkingJamPlayRecord", () => {
  test("保存した生のプレイ事実をパーキングジャム記録として認識すること", () => {
    const recognized = isParkingJamPlayRecord(record);

    expect(recognized).toBe(true);
  });

  describe("総操作数と成功・不成立操作数が一致しない場合", () => {
    const invalidRecord: PlayRecord = {
      ...record,
      payload: {
        ...record.payload,
        performance: {
          ...record.payload.performance,
          moveAttemptCount: 99,
        },
      },
    };

    test("記録として認識しないこと", () => {
      const recognized = isParkingJamPlayRecord(invalidRecord);

      expect(recognized).toBe(false);
    });
  });
});

describe("getParkingJamPlayRecordScore", () => {
  test("保存済み事実から評価点を再計算すること", () => {
    const score = getParkingJamPlayRecordScore(record);

    expect(score).toBe(93);
  });
});

describe("parkingJamPlayRecordDefinition", () => {
  test("難易度ごとに比較すること", () => {
    const comparisonKey =
      parkingJamPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("normal");
  });

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

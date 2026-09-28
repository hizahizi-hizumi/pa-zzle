import {
  createNanpurePlayRecord,
  getNanpurePlayRecordScore,
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import type { PlayRecord } from "@/records/play-record";

const performance = {
  elapsedMs: 120_000,
  mistakeCount: 1,
  undoCount: 2,
  restartCount: 0,
};

const record = createNanpurePlayRecord({
  difficulty: "3",
  problemIdentity: createNanpureProblemIdentity("locked-candidates", 740),
  startedAt: 1_000,
  completedAt: 121_000,
  result: performance,
});

// 3段階の難易度と、ヒント数を指定した生成器（版 "1"）で記録したプレイ。
const threeLevelPayload = {
  difficulty: "normal",
  problemIdentity: {
    generatorVersion: "1",
    seed: "nanpure-seed",
    conditions: { clueCount: 32 },
    generationAttempt: 1,
  },
  performance: { ...performance, mistakeCount: 0 },
};
const threeLevelRecord: PlayRecord = {
  id: "nanpure-three-level",
  gameId: "nanpure",
  startedAt: 0,
  completedAt: 60_000,
  payloadVersion: 1,
  payload: threeLevelPayload,
};

describe("createNanpurePlayRecord", () => {
  test("完了プレイの事実だけを保存用記録へ写すこと", () => {
    const { payloadVersion, payload } = record;

    expect(payloadVersion).toBe(2);
    expect(payload).toEqual({
      difficulty: "3",
      problemIdentity: {
        generatorVersion: "2",
        seed: "np-locked-candidates-740",
        conditions: { removalTechniqueLimit: "locked-candidates" },
      },
      performance,
    });
    expect(Object.hasOwn(payload.performance, "score")).toBe(false);
  });
});

describe("isNanpurePlayRecord", () => {
  const recognizedCases = [
    ["レベル1〜5の現在の形式", record],
    ["3段階の難易度で記録した payloadVersion 1", threeLevelRecord],
    [
      "生成器の版が今と違う問題のレベルの記録",
      {
        ...record,
        payload: {
          ...record.payload,
          problemIdentity: {
            generatorVersion: "3",
            seed: "np-future-1",
            conditions: {},
          },
        },
      },
    ],
  ] as const satisfies readonly (readonly [string, PlayRecord])[];

  test.each(recognizedCases)(
    "保存したプレイ事実をナンプレ記録として認識すること: %s",
    (_label, candidate) => {
      const recognized = isNanpurePlayRecord(candidate);

      expect(recognized).toBe(true);
    },
  );

  const invalidCases = [
    [
      "payloadVersion 2 なのに3段階の難易度",
      { ...record, payload: { ...record.payload, difficulty: "normal" } },
    ],
    [
      "payloadVersion 1 なのにレベルの難易度",
      {
        ...threeLevelRecord,
        payload: { ...threeLevelPayload, difficulty: "1" },
      },
    ],
    ["知らない payloadVersion", { ...record, payloadVersion: 3 }],
    [
      "ミス数が負",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: { ...performance, mistakeCount: -1 },
        },
      },
    ],
  ] as const satisfies readonly (readonly [string, PlayRecord])[];

  test.each(invalidCases)(
    "不整合な記録を認識しないこと: %s",
    (_label, candidate) => {
      const recognized = isNanpurePlayRecord(candidate);

      expect(recognized).toBe(false);
    },
  );
});

describe("getNanpurePlayRecordScore", () => {
  const cases = [
    ["レベル1〜5の記録", record, 91],
    ["3段階の記録", threeLevelRecord, 96],
  ] as const;

  test.each(cases)(
    "保存した事実から現在のプレイ評価を導出すること: %s",
    (_label, candidate, expected) => {
      if (!isNanpurePlayRecord(candidate)) {
        throw new Error("Expected a Nanpure record");
      }

      const score = getNanpurePlayRecordScore(candidate);

      expect(score).toBe(expected);
    },
  );
});

describe("nanpurePlayRecordDefinition", () => {
  const comparisonCases = [
    ["レベル1〜5の記録はレベル", record, "3"],
    ["3段階の記録は旧区分", threeLevelRecord, "normal"],
  ] as const;

  test.each(comparisonCases)(
    "難易度ごとに比較し旧3段階を新レベルと混ぜないこと: %s",
    (_label, candidate, expected) => {
      const comparisonKey =
        nanpurePlayRecordDefinition.getComparisonKey(candidate);

      expect(comparisonKey).toBe(expected);
    },
  );
});

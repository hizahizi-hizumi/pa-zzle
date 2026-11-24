import type { PlayRecord } from "@/features/records/play-record";
import {
  _private,
  createSolitairePlayRecord,
  isSolitairePlayRecord,
  restoreSolitaireRecordedResult,
  solitairePlayRecordDefinition,
} from "@/games/solitaire/play-record";
import {
  decodeSolitairePoolEntry,
  listSolitairePoolEntries,
} from "@/games/solitaire/problem/problem-pool";

const { getSolitairePlayRecordScore, getSolitairePlayRecordTimeDelta } =
  _private;

const problemIdentity = decodeSolitairePoolEntry(
  listSolitairePoolEntries("2")[0]!,
);
// 基準時間6分を54秒超えたので速さは 40 × (1 − 54 ÷ 360) = 34点。取り消した手3手で安定性は 60 − 6 = 54点。
const record = createSolitairePlayRecord({
  difficulty: "2",
  problemIdentity,
  startedAt: 1_000,
  completedAt: 415_000,
  result: {
    elapsedMs: 414_000,
    moveCount: 150,
    undoCount: 5,
    restartCount: 1,
    retractedMoveCount: 3,
  },
});

function withPerformance(performance: Record<string, unknown>): PlayRecord {
  return {
    ...record,
    payload: {
      ...record.payload,
      performance: { ...record.payload.performance, ...performance },
    },
  };
}

test("評価値を保存せず評価元の事実だけを保存用記録へ写すこと", () => {
  const performance = record.payload.performance;

  expect(record.id).toBe(`solitaire:1000:415000:${problemIdentity.seed}`);
  expect(record.payloadVersion).toBe(1);
  expect(performance).toEqual({
    elapsedMs: 414_000,
    moveCount: 150,
    undoCount: 5,
    restartCount: 1,
    retractedMoveCount: 3,
  });
});

test("保存した事実から現在のプレイ評価と基準時間との差を導出すること", () => {
  const score = getSolitairePlayRecordScore(record);
  const timeDelta = getSolitairePlayRecordTimeDelta(record);

  expect(score).toBe(88);
  expect(timeDelta).toBe(54_000);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const comparisonKey = solitairePlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("2");
});

test("クリアの成績として経過時間を読むこと", () => {
  const performance = solitairePlayRecordDefinition.getClearPerformance(record);

  expect(performance).toEqual({ elapsedMs: 414_000 });
});

describe("isSolitairePlayRecord", () => {
  test("保存用記録をソリティアの記録として認めること", () => {
    const recognized = isSolitairePlayRecord(record);

    expect(recognized).toBe(true);
  });

  const invalidRecords: [string, PlayRecord][] = [
    ["別のゲーム", { ...record, gameId: "water-sort" }],
    ["未知の payload 版", { ...record, payloadVersion: 2 }],
    [
      "未知の難易度",
      { ...record, payload: { ...record.payload, difficulty: "6" } },
    ],
    ["組札へ運ぶ52手に満たない手数", withPerformance({ moveCount: 51 })],
    ["打った手より多い待った", withPerformance({ undoCount: 151 })],
    [
      "打った手より多い取り消した手",
      withPerformance({ retractedMoveCount: 151 }),
    ],
    ["取り消した手の欠落", withPerformance({ retractedMoveCount: undefined })],
    ["負の経過時間", withPerformance({ elapsedMs: -1 })],
  ];

  test.each(invalidRecords)(
    "不正な記録を認めないこと: %s",
    (_name, invalid) => {
      const recognized = isSolitairePlayRecord(invalid);
      const score = getSolitairePlayRecordScore(invalid);

      expect(recognized).toBe(false);
      expect(score).toBeNull();
    },
  );
});

describe("restoreSolitaireRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績から結果を作り直すこと", () => {
      const recorded = restoreSolitaireRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "2",
        problemIdentity,
        result: {
          elapsedMs: 414_000,
          moveCount: 150,
          undoCount: 5,
          restartCount: 1,
          retractedMoveCount: 3,
          speedRule: { fullScoreMs: 360_000, zeroScoreMs: 720_000 },
          timeDeltaMs: 54_000,
          score: { total: 88, breakdown: { stability: 54, speed: 34 } },
        },
      });
    });
  });

  describe("読み戻した成績に余分な項目がある場合", () => {
    const recordWithExtra = withPerformance({ bonus: 10 });

    test("余分な項目を結果へ持ち込まないこと", () => {
      const recorded = restoreSolitaireRecordedResult(recordWithExtra);

      expect(recorded).not.toBeNull();
      expect(Object.hasOwn(recorded!.result, "bonus")).toBe(false);
    });
  });

  describe("別の生成器の版の記録の場合", () => {
    const otherGeneratorRecord: PlayRecord = {
      ...record,
      payload: {
        ...record.payload,
        problemIdentity: { ...problemIdentity, generatorVersion: "0" },
      },
    };

    test("記録として読んで評価し、結果画面に出す内容は作り直さないこと", () => {
      const recognized = isSolitairePlayRecord(otherGeneratorRecord);
      const score = getSolitairePlayRecordScore(otherGeneratorRecord);
      const recorded = restoreSolitaireRecordedResult(otherGeneratorRecord);

      expect(recognized).toBe(true);
      expect(score).toBe(88);
      expect(recorded).toBeNull();
    });
  });
});

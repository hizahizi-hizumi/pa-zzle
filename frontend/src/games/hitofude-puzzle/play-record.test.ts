import { createHitofudePuzzleResult } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import {
  createHitofudePuzzlePlayRecord,
  getHitofudePuzzlePlayRecordScore,
  getHitofudePuzzlePlayRecordTimeDelta,
  hitofudePuzzlePlayRecordDefinition,
  isHitofudePuzzlePlayRecord,
  restoreHitofudePuzzleRecordedResult,
} from "@/games/hitofude-puzzle/play-record";
import { createHitofudePuzzleProblemIdentity } from "@/games/hitofude-puzzle/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createHitofudePuzzleProblemIdentity(8, 4, 16);

// 基準時間は 5 + 55×0.5 + 12×3 + 3×3 + 22×1 = 99.5秒。
const workload = {
  openCellCount: 55,
  assumptionCount: 3,
  refutationStepCount: 22,
  longestRefutationLength: 9,
  fatalBranchCount: 12,
};

// 速さは 60 × (1 − 29秒 / 199秒) ≒ 51点、正確さは 40 − 3×3 = 31点。
const performance = {
  elapsedMs: 128_500,
  backtrackCount: 3,
  retractedCellCount: 20,
  undoCount: 2,
  restartCount: 1,
  inputCount: 40,
};
const expectedScore = 82;
const expectedTimeDeltaMs = 29_000;

const record = createHitofudePuzzlePlayRecord({
  difficulty: "5",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 129_500,
  result: performance,
});

// 今の生成器の版でない identity は生成条件を確かめないので、作業の量の形だけを確かめられる。
/** 仕切りのあるルールの生成器（版 1）の identity。 */
const pastProblemIdentity = {
  generatorVersion: "1",
  seed: "hp-8-0-16",
  conditions: { size: 8, wallRatio: 0 },
};

function withPayload(overrides: Record<string, unknown>) {
  return { ...record, payload: { ...record.payload, ...overrides } };
}

describe("createHitofudePuzzlePlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "hitofude-puzzle:1000:129500:hp-8-t4-16",
      gameId: "hitofude-puzzle",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "5",
      problemIdentity: {
        generatorVersion: "3",
        seed: "hp-8-t4-16",
        conditions: { size: 8, targetLookaheadLoad: 4 },
      },
      workload,
      performance,
    });
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });

  describe("評価を含む結果を渡した場合", () => {
    const recordFromResult = createHitofudePuzzlePlayRecord({
      difficulty: "5",
      problemIdentity,
      workload,
      startedAt: 1_000,
      completedAt: 129_500,
      result: createHitofudePuzzleResult(performance, workload),
    });

    test("評価を保存しないこと", () => {
      const { performance: savedPerformance } = recordFromResult.payload;

      expect(savedPerformance).toEqual(performance);
    });
  });
});

describe("getHitofudePuzzlePlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getHitofudePuzzlePlayRecordScore(record);

    expect(score).toBe(expectedScore);
  });
});

describe("getHitofudePuzzlePlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getHitofudePuzzlePlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(expectedTimeDeltaMs);
  });
});

describe("isHitofudePuzzlePlayRecord", () => {
  const validCases = [
    ["作成した記録", record],
    [
      "生成器の版が今と違う記録",
      withPayload({ problemIdentity: pastProblemIdentity }),
    ],
    [
      "引き直しが入力回数と待ったの回数の合計と同じ記録",
      withPayload({
        performance: { ...performance, backtrackCount: 42 },
      }),
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
      "今の生成器の版で扱えない盤面サイズの identity",
      withPayload({
        problemIdentity: {
          ...problemIdentity,
          conditions: { size: 10, targetLookaheadLoad: 0 },
        },
      }),
    ],
    ["作業の量が無い記録", withPayload({ workload: undefined })],
    [
      "道が通るマスが無い作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, openCellCount: 0 },
      }),
    ],
    [
      "最も長い先読みが先読みの手数の合計を超える作業の量",
      withPayload({
        problemIdentity: pastProblemIdentity,
        workload: { ...workload, longestRefutationLength: 72 },
      }),
    ],
    [
      "整数でない仮置きの回数",
      withPayload({ workload: { ...workload, assumptionCount: 1.5 } }),
    ],
    [
      "道が通るマスの数が identity の枠のマスの数を超える作業の量",
      withPayload({ workload: { ...workload, openCellCount: 65 } }),
    ],
    [
      "負の経過時間",
      withPayload({ performance: { ...performance, elapsedMs: -1 } }),
    ],
    [
      "整数でない引き直し回数",
      withPayload({ performance: { ...performance, backtrackCount: 1.5 } }),
    ],
    [
      "入力回数と待ったの回数の合計より多い引き直し回数",
      withPayload({ performance: { ...performance, backtrackCount: 43 } }),
    ],
    [
      "入力回数より多い待ったの回数",
      withPayload({ performance: { ...performance, undoCount: 41 } }),
    ],
    [
      "戻したマスの数が無い記録",
      withPayload({
        performance: { ...performance, retractedCellCount: undefined },
      }),
    ],
    [
      "盤面を戻した回数が無い記録",
      withPayload({ performance: { ...performance, restartCount: undefined } }),
    ],
  ] as const;

  test.each(validCases)("%s を読み込むこと", (_, value) => {
    const accepted = isHitofudePuzzlePlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isHitofudePuzzlePlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("hitofudePuzzlePlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms", "backtrack-count"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey =
      hitofudePuzzlePlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("5");
  });

  test("自己ベストを評価点は高いほど、基準時間との差と引き直し回数は小さいほど良いとして比べること", () => {
    const directions =
      hitofudePuzzlePlayRecordDefinition.personalBestMetrics.map(
        ({ id, direction }) => [id, direction],
      );

    expect(directions).toEqual([
      ["play-score", "higher"],
      ["time-delta-ms", "lower"],
      ["backtrack-count", "lower"],
    ]);
  });

  test("記録から自己ベストの各指標の値を求めること", () => {
    const values = metricIds.map((metricId) =>
      getPlayRecordMetricValue(
        record,
        hitofudePuzzlePlayRecordDefinition,
        metricId,
      ),
    );

    expect(values).toEqual([expectedScore, expectedTimeDeltaMs, 3]);
  });

  describe("生成器の版が今と違う記録の場合", () => {
    const pastRecord = withPayload({ problemIdentity: pastProblemIdentity });

    test("記録に残した作業の量で評価し、自己ベストの比較に含めること", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          pastRecord,
          hitofudePuzzlePlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([expectedScore, expectedTimeDeltaMs, 3]);
    });
  });

  describe("読み込めない記録の場合", () => {
    const brokenRecord = withPayload({ workload: undefined });

    test("評価と自己ベストの値を持たないこと", () => {
      const values = metricIds.map((metricId) =>
        getPlayRecordMetricValue(
          brokenRecord,
          hitofudePuzzlePlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([null, null, null]);
    });
  });
});

describe("restoreHitofudePuzzleRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreHitofudePuzzleRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "5",
        problemIdentity,
        result: {
          ...performance,
          workload,
          speedRule: { fullScoreMs: 99_500, zeroScoreMs: 298_500 },
          timeDeltaMs: expectedTimeDeltaMs,
          score: {
            total: expectedScore,
            breakdown: { speed: 51, accuracy: 31 },
          },
        },
      });
    });
  });

  describe("読み戻した記録に余分な項目がある場合", () => {
    const recordWithExtra = withPayload({
      performance: { ...performance, blockedMoveCount: 4 },
    });

    test("記録の項目だけで結果を作ること", () => {
      const recorded = restoreHitofudePuzzleRecordedResult(recordWithExtra);

      expect(recorded?.result).not.toHaveProperty("blockedMoveCount");
    });
  });

  describe("今の版でない記録の場合", () => {
    const unrestorableRecords = [
      ["別の payload の版の記録", { ...record, payloadVersion: 2 }],
      [
        "生成器の版が今と違う記録",
        withPayload({ problemIdentity: pastProblemIdentity }),
      ],
    ] as const;

    test.each(unrestorableRecords)("%s から結果を作らないこと", (_, value) => {
      const recorded = restoreHitofudePuzzleRecordedResult(value);

      expect(recorded).toBeNull();
    });
  });
});

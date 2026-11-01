import { createHamiltonianPathResult } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  createHamiltonianPathPlayRecord,
  getHamiltonianPathPlayRecordScore,
  getHamiltonianPathPlayRecordTimeDelta,
  hamiltonianPathPlayRecordDefinition,
  isHamiltonianPathPlayRecord,
  restoreHamiltonianPathRecordedResult,
} from "@/games/hamiltonian-path/play-record";
import { createHamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const problemIdentity = createHamiltonianPathProblemIdentity(8, 7, 16);

// 基準時間は 5 + 64×0.5 + 13×3 + 8×3 + 71×1 = 171秒。
const workload = {
  openCellCount: 64,
  assumptionCount: 8,
  refutationStepCount: 71,
  longestRefutationLength: 18,
  fatalBranchCount: 13,
};

// 速さは 60 × (1 − 29秒 / 342秒) ≒ 55点、正確さは 40 − 3×3 = 31点。
const performance = {
  elapsedMs: 200_000,
  backtrackCount: 3,
  retractedCellCount: 20,
  undoCount: 2,
  restartCount: 1,
  inputCount: 40,
};
const expectedScore = 86;
const expectedTimeDeltaMs = 29_000;

const record = createHamiltonianPathPlayRecord({
  difficulty: "5",
  problemIdentity,
  workload,
  startedAt: 1_000,
  completedAt: 201_000,
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

describe("createHamiltonianPathPlayRecord", () => {
  test("完了プレイと遊んだ問題の事実だけを保存用記録へ写すこと", () => {
    const { id, gameId, payloadVersion, payload } = record;

    expect({ id, gameId, payloadVersion }).toEqual({
      id: "hamiltonian-path:1000:201000:hp-8-t7-16",
      gameId: "hamiltonian-path",
      payloadVersion: 1,
    });
    expect(payload).toEqual({
      difficulty: "5",
      problemIdentity: {
        generatorVersion: "2",
        seed: "hp-8-t7-16",
        conditions: { size: 8, targetAssumptionCount: 7 },
      },
      workload,
      performance,
    });
    expect(payload.problemIdentity).not.toBe(problemIdentity);
  });

  describe("評価を含む結果を渡した場合", () => {
    const recordFromResult = createHamiltonianPathPlayRecord({
      difficulty: "5",
      problemIdentity,
      workload,
      startedAt: 1_000,
      completedAt: 201_000,
      result: createHamiltonianPathResult(performance, workload),
    });

    test("評価を保存しないこと", () => {
      const { performance: savedPerformance } = recordFromResult.payload;

      expect(savedPerformance).toEqual(performance);
    });
  });
});

describe("getHamiltonianPathPlayRecordScore", () => {
  test("保存した事実から現在のプレイ評価を導出すること", () => {
    const score = getHamiltonianPathPlayRecordScore(record);

    expect(score).toBe(expectedScore);
  });
});

describe("getHamiltonianPathPlayRecordTimeDelta", () => {
  test("保存した作業の量から基準時間との差を導出すること", () => {
    const timeDeltaMs = getHamiltonianPathPlayRecordTimeDelta(record);

    expect(timeDeltaMs).toBe(expectedTimeDeltaMs);
  });
});

describe("isHamiltonianPathPlayRecord", () => {
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
          conditions: { size: 10, targetAssumptionCount: 0 },
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
    const accepted = isHamiltonianPathPlayRecord(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s を読み込まないこと", (_, value) => {
    const accepted = isHamiltonianPathPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("hamiltonianPathPlayRecordDefinition", () => {
  const metricIds = ["play-score", "time-delta-ms", "backtrack-count"];

  test("難易度を自己ベストの比較単位として扱うこと", () => {
    const comparisonKey =
      hamiltonianPathPlayRecordDefinition.getComparisonKey(record);

    expect(comparisonKey).toBe("5");
  });

  test("自己ベストを評価点は高いほど、基準時間との差と引き直し回数は小さいほど良いとして比べること", () => {
    const directions =
      hamiltonianPathPlayRecordDefinition.personalBestMetrics.map(
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
        hamiltonianPathPlayRecordDefinition,
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
          hamiltonianPathPlayRecordDefinition,
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
          hamiltonianPathPlayRecordDefinition,
          metricId,
        ),
      );

      expect(values).toEqual([null, null, null]);
    });
  });
});

describe("restoreHamiltonianPathRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績と問題の作業の量から結果を作り直すこと", () => {
      const recorded = restoreHamiltonianPathRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "5",
        problemIdentity,
        result: {
          ...performance,
          workload,
          speedRule: { fullScoreMs: 171_000, zeroScoreMs: 513_000 },
          timeDeltaMs: expectedTimeDeltaMs,
          score: {
            total: expectedScore,
            breakdown: { speed: 55, accuracy: 31 },
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
      const recorded = restoreHamiltonianPathRecordedResult(recordWithExtra);

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
      const recorded = restoreHamiltonianPathRecordedResult(value);

      expect(recorded).toBeNull();
    });
  });
});

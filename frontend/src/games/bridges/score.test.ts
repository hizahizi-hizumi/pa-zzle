import type { BridgesSolveWorkload } from "@/games/bridges/problem/workload";
import {
  calculateBridgesPlayScore,
  calculateBridgesSpeedFullScoreMs,
  calculateBridgesSpeedScoreRule,
  calculateBridgesTimeDeltaMs,
  calculateBridgesZeroScoreRatio,
} from "@/games/bridges/score";
import { getGameResultLevel } from "@/games/result";

// 数字の読みだけで決まる小さな盤面と、つながりを何度も読む大きな盤面の作業の量。
const lightWorkload: BridgesSolveWorkload = {
  islandCount: 11,
  edgeCount: 11,
  bridgeCount: 12,
  countRoundCount: 0,
  connectivityRoundCount: 0,
  countReasoningUndecidedEdgeCount: 0,
};
const heavyWorkload: BridgesSolveWorkload = {
  islandCount: 24,
  edgeCount: 32,
  bridgeCount: 26,
  countRoundCount: 3,
  connectivityRoundCount: 3,
  countReasoningUndecidedEdgeCount: 26,
  crossingBlockCount: 2,
};

// 見渡す10秒・島11個・橋12本。
const lightFullScoreMs = 10_000 + 11_000 + 18_000;
// 見渡す10秒・島24個・橋26本に、読みの項（配分3回・つながり3回・交差2つ・決まらない行き先26）を足す。
const heavyReadingMs = 45_000 + 120_000 + 8_000 + 26_000;
const heavyFullScoreMs = 10_000 + 24_000 + 39_000 + heavyReadingMs;

describe("calculateBridgesSpeedFullScoreMs", () => {
  const cases = [
    ["数字の読みだけで決まる小さな盤面", lightWorkload, lightFullScoreMs],
    ["つながりを何度も読む大きな盤面", heavyWorkload, heavyFullScoreMs],
  ] as const;

  test.each(cases)(
    "%sで、見渡す10秒に島1つ1秒・橋1本1.5秒・配分の読みのまとまり1つ15秒・つながりの手詰まり1回40秒・交差で塞がる行き先1つ4秒・決まらない行き先1つ1秒を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateBridgesSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("つながりの手詰まりのうち1手の先読みが要った回数がある場合", () => {
    test("1回ごとに110秒を足すこと", () => {
      const speedFullScoreMs = calculateBridgesSpeedFullScoreMs({
        ...heavyWorkload,
        lookaheadRoundCount: 2,
      });

      expect(speedFullScoreMs).toBe(heavyFullScoreMs + 220_000);
    });
  });

  describe("先読みと交差の回数の無い作業の量の場合", () => {
    test("0回として扱うこと", () => {
      const { crossingBlockCount: _, ...withoutCrossing } = heavyWorkload;

      expect(calculateBridgesSpeedFullScoreMs(withoutCrossing)).toBe(
        heavyFullScoreMs - 8_000,
      );
    });
  });

  describe("行き先の数だけが違う場合", () => {
    const moreEdges = { ...lightWorkload, edgeCount: 15 };

    test("基準時間が変わらないこと", () => {
      const speedFullScoreMs = calculateBridgesSpeedFullScoreMs(moreEdges);

      expect(speedFullScoreMs).toBe(lightFullScoreMs);
    });
  });
});

describe("calculateBridgesZeroScoreRatio", () => {
  test("読みの無い問題は3倍にすること", () => {
    expect(calculateBridgesZeroScoreRatio(lightWorkload)).toBe(3);
  });

  test("読みの項の割合の3倍を3に足し、0.1単位に丸めること", () => {
    const expected =
      Math.round((3 + (3 * heavyReadingMs) / heavyFullScoreMs) * 10) / 10;

    expect(calculateBridgesZeroScoreRatio(heavyWorkload)).toBe(expected);
    expect(expected).toBe(5.2);
  });
});

describe("calculateBridgesSpeedScoreRule", () => {
  test("基準時間と、その倍率で0点になる時間を返すこと", () => {
    const rule = calculateBridgesSpeedScoreRule(heavyWorkload);

    expect(rule).toEqual({
      fullScoreMs: heavyFullScoreMs,
      zeroScoreMs: heavyFullScoreMs * 5.2,
    });
  });
});

describe("calculateBridgesTimeDeltaMs", () => {
  test("クリア時間から基準時間を引いた差を返すこと", () => {
    const deltaMs = calculateBridgesTimeDeltaMs({
      elapsedMs: 50_000,
      workload: lightWorkload,
    });

    expect(deltaMs).toBe(50_000 - lightFullScoreMs);
  });
});

describe("calculateBridgesPlayScore", () => {
  const cases = [
    ["基準時間ちょうど", 1, 100, "perfect"],
    ["基準時間の1.2倍", 1.2, 90, "great"],
    ["基準時間の1.4倍", 1.4, 80, "good"],
    ["基準時間の2倍", 2, 50, "clear"],
    ["基準時間の3倍", 3, 0, "clear"],
  ] as const;

  test.each(cases)(
    "読みの無い問題を%sでクリアしたとき、速さだけで%d点・%sになること",
    (_, elapsedRatio, expectedTotal, expectedLevel) => {
      const score = calculateBridgesPlayScore({
        elapsedMs: lightFullScoreMs * elapsedRatio,
        workload: lightWorkload,
      });

      expect(score).toEqual({
        total: expectedTotal,
        breakdown: { speed: expectedTotal },
      });
      expect(getGameResultLevel(score.total)).toBe(expectedLevel);
    },
  );
});

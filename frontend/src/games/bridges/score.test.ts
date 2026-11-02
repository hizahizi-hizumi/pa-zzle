import type { BridgesSolveWorkload } from "@/games/bridges/problem/workload";
import {
  calculateBridgesPlayScore,
  calculateBridgesSpeedFullScoreMs,
  calculateBridgesSpeedScoreRule,
  calculateBridgesTimeDeltaMs,
} from "@/games/bridges/score";
import { getGameResultLevel } from "@/games/result";

// レベル1 と レベル5 の問題集の中央値に近い作業の量。
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
};

const lightFullScoreMs = 28_600;
const heavyFullScoreMs = 105_800;

describe("calculateBridgesSpeedFullScoreMs", () => {
  const cases = [
    ["数字の読みだけで決まる小さな盤面", lightWorkload, lightFullScoreMs],
    ["つながりを何度も読む大きな盤面", heavyWorkload, heavyFullScoreMs],
  ] as const;

  test.each(cases)(
    "%sで、見渡す8秒に島1つ1秒・橋1本0.8秒・少なくとも1本の手詰まり1回3秒・つながりの手詰まり1回6秒・決まらない行き先1つ1秒を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateBridgesSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("行き先の数だけが違う場合", () => {
    const moreEdges = { ...lightWorkload, edgeCount: 15 };

    test("基準時間が変わらないこと", () => {
      const speedFullScoreMs = calculateBridgesSpeedFullScoreMs(moreEdges);

      expect(speedFullScoreMs).toBe(lightFullScoreMs);
    });
  });
});

describe("calculateBridgesSpeedScoreRule", () => {
  test("基準時間の3倍で0点になる規則を返すこと", () => {
    const rule = calculateBridgesSpeedScoreRule(lightWorkload);

    expect(rule).toEqual({
      fullScoreMs: lightFullScoreMs,
      zeroScoreMs: lightFullScoreMs * 3,
    });
  });
});

describe("calculateBridgesTimeDeltaMs", () => {
  test("クリア時間から基準時間を引いた差を返すこと", () => {
    const deltaMs = calculateBridgesTimeDeltaMs({
      elapsedMs: 30_000,
      workload: lightWorkload,
    });

    expect(deltaMs).toBe(30_000 - lightFullScoreMs);
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
    "%sでクリアしたとき、速さだけで%d点・%sになること",
    (_, elapsedRatio, expectedTotal, expectedLevel) => {
      const score = calculateBridgesPlayScore({
        elapsedMs: heavyFullScoreMs * elapsedRatio,
        workload: heavyWorkload,
      });

      expect(score).toEqual({
        total: expectedTotal,
        breakdown: { speed: expectedTotal },
      });
      expect(getGameResultLevel(score.total)).toBe(expectedLevel);
    },
  );
});

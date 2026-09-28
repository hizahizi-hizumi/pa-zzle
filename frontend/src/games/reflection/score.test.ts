import type { ReflectionSolveWorkload } from "@/games/reflection/problem/problem";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedFullScoreMs,
  calculateReflectionSpeedZeroScoreMs,
  calculateReflectionTimeDeltaMs,
  getReflectionGameResultLevel,
} from "@/games/reflection/score";

// レベル1 の代表 rf-5-2-86 と、レベル5 の代表 rf-7-11-76 の作業の量。
const lightWorkload: ReflectionSolveWorkload = {
  pieceCount: 2,
  clueCount: 20,
  propagationRoundCount: 0,
  assumptionTestCount: 0,
};
const heavyWorkload: ReflectionSolveWorkload = {
  pieceCount: 11,
  clueCount: 28,
  propagationRoundCount: 14,
  assumptionTestCount: 40,
};

const lightFullScoreMs = 22_000;
const heavyFullScoreMs = 342_000;

function scoreAtRatio(
  elapsedRatio: number,
  workload: ReflectionSolveWorkload = lightWorkload,
): number {
  return calculateReflectionPlayScore({
    elapsedMs: calculateReflectionSpeedFullScoreMs(workload) * elapsedRatio,
    workload,
  });
}

describe("calculateReflectionSpeedFullScoreMs", () => {
  const cases = [
    ["2ピースで照らし直しの無い問題", lightWorkload, lightFullScoreMs],
    [
      "照らし直しが多く、仮に置く回数が上限を超える問題",
      heavyWorkload,
      heavyFullScoreMs,
    ],
  ] as const;

  test.each(cases)(
    "%s で、外周ヒント1本0.5秒・ピース1個6秒・照らし直し1回8秒・仮に置く1回15秒（10回まで）を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateReflectionSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("仮に置いた回数だけが上限の前後で違う場合", () => {
    const atLimit = { ...heavyWorkload, assumptionTestCount: 10 };
    const overLimit = { ...heavyWorkload, assumptionTestCount: 776 };

    test("上限を超えた分は基準時間を伸ばさないこと", () => {
      const atLimitMs = calculateReflectionSpeedFullScoreMs(atLimit);
      const overLimitMs = calculateReflectionSpeedFullScoreMs(overLimit);

      expect(overLimitMs).toBe(atLimitMs);
    });
  });

  describe("照らし直しの回数だけが違う場合", () => {
    const fewerRounds = { ...heavyWorkload, propagationRoundCount: 5 };

    test("照らし直しが多い方の基準時間を長くすること", () => {
      const moreRoundsMs = calculateReflectionSpeedFullScoreMs(heavyWorkload);
      const fewerRoundsMs = calculateReflectionSpeedFullScoreMs(fewerRounds);

      expect(moreRoundsMs).toBeGreaterThan(fewerRoundsMs);
    });
  });
});

describe("calculateReflectionSpeedZeroScoreMs", () => {
  test("基準時間の3倍を返すこと", () => {
    const speedZeroScoreMs = calculateReflectionSpeedZeroScoreMs(lightWorkload);

    expect(speedZeroScoreMs).toBe(lightFullScoreMs * 3);
  });
});

describe("calculateReflectionTimeDeltaMs", () => {
  const cases = [
    ["基準時間より速い", lightFullScoreMs - 5_000, -5_000],
    ["基準時間より遅い", lightFullScoreMs + 12_000, 12_000],
  ] as const;

  test.each(cases)(
    "%s クリア時間から、基準時間との差を返すこと",
    (_, elapsedMs, expected) => {
      const timeDeltaMs = calculateReflectionTimeDeltaMs({
        elapsedMs,
        workload: lightWorkload,
      });

      expect(timeDeltaMs).toBe(expected);
    },
  );
});

describe("calculateReflectionPlayScore", () => {
  const speedCases = [
    [0.5, 100],
    [1, 100],
    [1.2, 90],
    [1.4, 80],
    [2, 50],
    [3, 0],
    [4, 0],
  ] as const;

  test.each(speedCases)(
    "基準時間の %s 倍で解いたプレイを %s 点にすること",
    (elapsedRatio, expected) => {
      const score = scoreAtRatio(elapsedRatio);

      expect(score).toBe(expected);
    },
  );

  describe("基準時間に対して同じ割合で解いた場合", () => {
    const elapsedRatio = 1.3;

    test("作業の量が違う問題でも同じ点にすること", () => {
      const heavyScore = scoreAtRatio(elapsedRatio, heavyWorkload);
      const lightScore = scoreAtRatio(elapsedRatio, lightWorkload);

      expect(heavyScore).toBe(lightScore);
    });
  });
});

describe("代表的なプレイ例", () => {
  const levelCases = [
    ["基準時間より速い", 0.8, "perfect"],
    ["基準時間ちょうど", 1, "perfect"],
    ["基準時間の1.2倍", 1.2, "great"],
    ["基準時間の1.4倍", 1.4, "good"],
    ["基準時間の1.5倍", 1.5, "clear"],
  ] as const;

  test.each(levelCases)("%s のプレイを %s にすること", (_, ratio, level) => {
    const resultLevel = getReflectionGameResultLevel(scoreAtRatio(ratio));

    expect(resultLevel).toBe(level);
  });

  describe("速さの割合だけが違う場合", () => {
    const ratios = [1, 1.1, 1.3, 1.6, 2, 2.5];

    test("遅いほど評価を下げること", () => {
      const scores = ratios.map((ratio) => scoreAtRatio(ratio));

      expect(scores).toEqual([...scores].sort((left, right) => right - left));
      expect(new Set(scores).size).toBe(scores.length);
    });
  });
});

describe("getReflectionGameResultLevel", () => {
  const cases = [
    [100, "perfect"],
    [99, "great"],
    [90, "great"],
    [89, "good"],
    [80, "good"],
    [79, "clear"],
    [0, "clear"],
  ] as const;

  test.each(cases)("%i 点を %s にすること", (score, level) => {
    const resultLevel = getReflectionGameResultLevel(score);

    expect(resultLevel).toBe(level);
  });
});

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

type PlayExample = {
  elapsedRatio: number;
  relocationCount: number;
  restartCount: number;
};

function scorePlay(
  { elapsedRatio, relocationCount, restartCount }: PlayExample,
  workload: ReflectionSolveWorkload = lightWorkload,
): number {
  return calculateReflectionPlayScore({
    elapsedMs: calculateReflectionSpeedFullScoreMs(workload) * elapsedRatio,
    relocationCount,
    restartCount,
    workload,
  }).total;
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
  test("基準時間の2倍を返すこと", () => {
    const speedZeroScoreMs = calculateReflectionSpeedZeroScoreMs(lightWorkload);

    expect(speedZeroScoreMs).toBe(lightFullScoreMs * 2);
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
  describe("置き直しも盤面を戻すこともなく基準時間内に解いた場合", () => {
    const play = {
      elapsedMs: lightFullScoreMs,
      relocationCount: 0,
      restartCount: 0,
      workload: lightWorkload,
    };

    test("正確性60点と速さ40点の満点にすること", () => {
      const score = calculateReflectionPlayScore(play);

      expect(score).toEqual({
        total: 100,
        breakdown: { accuracy: 60, speed: 40 },
      });
    });
  });

  const accuracyCases = [
    ["置き直し3回・盤面を戻した回数1回", 3, 1, 30],
    ["置き直し10回・盤面を戻した回数2回", 10, 2, 0],
  ] as const;

  test.each(accuracyCases)(
    "%s で、置き直し1回につき5点・盤面を戻した1回につき15点を0点を下限に減点すること",
    (_, relocationCount, restartCount, expected) => {
      const score = calculateReflectionPlayScore({
        elapsedMs: lightFullScoreMs,
        relocationCount,
        restartCount,
        workload: lightWorkload,
      });

      expect(score.breakdown.accuracy).toBe(expected);
    },
  );

  const speedCases = [
    [0.5, 40],
    [1.25, 30],
    [1.5, 20],
    [2, 0],
    [3, 0],
  ] as const;

  test.each(speedCases)(
    "基準時間の %s 倍で解いたプレイの速さを %s 点にすること",
    (elapsedRatio, expected) => {
      const score = calculateReflectionPlayScore({
        elapsedMs: lightFullScoreMs * elapsedRatio,
        relocationCount: 0,
        restartCount: 0,
        workload: lightWorkload,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  describe("基準時間に対して同じ割合で解いた場合", () => {
    const play = { elapsedRatio: 1.3, relocationCount: 0, restartCount: 0 };

    test("作業の量が違う問題でも同じ点にすること", () => {
      const heavyScore = scorePlay(play, heavyWorkload);
      const lightScore = scorePlay(play, lightWorkload);

      expect(heavyScore).toBe(lightScore);
    });
  });
});

describe("代表的なプレイ例", () => {
  const plays = {
    fastClean: { elapsedRatio: 0.8, relocationCount: 0, restartCount: 0 },
    slightlySlowClean: {
      elapsedRatio: 1.2,
      relocationCount: 0,
      restartCount: 0,
    },
    slowClean: { elapsedRatio: 1.4, relocationCount: 0, restartCount: 0 },
    verySlowClean: { elapsedRatio: 2.5, relocationCount: 0, restartCount: 0 },
    oneMisplacement: { elapsedRatio: 0.9, relocationCount: 1, restartCount: 0 },
    twoRelocations: { elapsedRatio: 1, relocationCount: 2, restartCount: 0 },
    threeRelocations: { elapsedRatio: 1, relocationCount: 3, restartCount: 0 },
    fastGuessing: { elapsedRatio: 0.6, relocationCount: 6, restartCount: 0 },
    heavyGuessing: { elapsedRatio: 1.5, relocationCount: 10, restartCount: 0 },
    cleanRestart: { elapsedRatio: 1, relocationCount: 0, restartCount: 1 },
    restartAfterStuck: {
      elapsedRatio: 1.5,
      relocationCount: 1,
      restartCount: 1,
    },
  } satisfies Record<string, PlayExample>;

  const levelCases = [
    ["速く、置き直しなし", plays.fastClean, "perfect"],
    ["少し遅いが、置き直しなし", plays.slightlySlowClean, "great"],
    ["置き間違いを1回直した", plays.oneMisplacement, "great"],
    ["置き直し2回", plays.twoRelocations, "great"],
    ["遅いが、置き直しなし", plays.slowClean, "good"],
    ["置き直し3回", plays.threeRelocations, "good"],
    ["置き直しなしで、盤面を1回戻した", plays.cleanRestart, "good"],
    ["速いが、試し置きで6回置き直した", plays.fastGuessing, "clear"],
    ["とても遅い", plays.verySlowClean, "clear"],
    ["行き詰まって盤面を戻した", plays.restartAfterStuck, "clear"],
  ] as const;

  test.each(levelCases)("%s プレイを %s にすること", (_, play, level) => {
    const resultLevel = getReflectionGameResultLevel(scorePlay(play));

    expect(resultLevel).toBe(level);
  });

  const higherCases = [
    [
      "置き直しなしで少し遅い",
      plays.slightlySlowClean,
      "速いが試し置きで何回も置き直した",
      plays.fastGuessing,
    ],
    [
      "置き直しなしで遅い",
      plays.slowClean,
      "速いが試し置きで何回も置き直した",
      plays.fastGuessing,
    ],
    [
      "とても遅くても置き直しなしで解き切った",
      plays.verySlowClean,
      "試し置きを重ねた",
      plays.heavyGuessing,
    ],
    [
      "置き直しなしで盤面を戻さずに解いた",
      { elapsedRatio: 1.5, relocationCount: 0, restartCount: 0 },
      "同じ時間で盤面を戻した",
      { elapsedRatio: 1.5, relocationCount: 0, restartCount: 1 },
    ],
  ] as const;

  test.each(higherCases)(
    "%s プレイを、%s プレイより高く評価すること",
    (_, higherPlay, __, lowerPlay) => {
      const higherScore = scorePlay(higherPlay);
      const lowerScore = scorePlay(lowerPlay);

      expect(higherScore).toBeGreaterThan(lowerScore);
    },
  );

  describe("同じ速さで置き直しの回数だけが違う場合", () => {
    const relocationCounts = [0, 1, 2, 3, 6, 12];

    test("置き直しが多いほど評価を下げること", () => {
      const scores = relocationCounts.map((relocationCount) =>
        scorePlay({ elapsedRatio: 1, relocationCount, restartCount: 0 }),
      );

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

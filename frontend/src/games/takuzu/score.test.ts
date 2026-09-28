import { getGameResultLevel } from "@/games/result";
import type { TakuzuSolveWorkload } from "@/games/takuzu/problem/problem";
import {
  calculateTakuzuPlayScore,
  calculateTakuzuSpeedFullScoreMs,
  calculateTakuzuSpeedZeroScoreMs,
  calculateTakuzuTimeDeltaMs,
} from "@/games/takuzu/score";

// レベル 1 と レベル 5 の問題集の中央値に近い作業の量。
const lightWorkload: TakuzuSolveWorkload = {
  emptyCellCount: 42,
  roundCount: 6,
  lineReadingRoundCount: 0,
};
const heavyWorkload: TakuzuSolveWorkload = {
  emptyCellCount: 46,
  roundCount: 20,
  lineReadingRoundCount: 4,
};

const lightFullScoreMs = 112_000;
const heavyFullScoreMs = 202_000;

type PlayExample = {
  elapsedRatio: number;
  correctionCount: number;
  restartCount: number;
  undoCount?: number;
};

function scorePlay(
  { elapsedRatio, correctionCount, restartCount, undoCount = 0 }: PlayExample,
  workload: TakuzuSolveWorkload = lightWorkload,
): number {
  return calculateTakuzuPlayScore({
    elapsedMs: calculateTakuzuSpeedFullScoreMs(workload) * elapsedRatio,
    correctionCount,
    restartCount,
    undoCount,
    workload,
  }).total;
}

describe("calculateTakuzuSpeedFullScoreMs", () => {
  const cases = [
    ["置く数が少なく行・列を読まない問題", lightWorkload, lightFullScoreMs],
    ["探す局面と行・列を読む局面が多い問題", heavyWorkload, heavyFullScoreMs],
  ] as const;

  test.each(cases)(
    "%s で、盤面把握10秒に空きマス1つ2秒・局面1つ3秒・行と列を読む局面1つ10秒を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateTakuzuSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("行・列を読む局面だけが違う問題の場合", () => {
    const withoutLineReading = {
      ...heavyWorkload,
      lineReadingRoundCount: 0,
    };

    test("行・列を読む局面が多い方の基準時間を長くすること", () => {
      const withLineReadingMs = calculateTakuzuSpeedFullScoreMs(heavyWorkload);
      const withoutLineReadingMs =
        calculateTakuzuSpeedFullScoreMs(withoutLineReading);

      expect(withLineReadingMs).toBeGreaterThan(withoutLineReadingMs);
    });
  });
});

describe("calculateTakuzuSpeedZeroScoreMs", () => {
  test("基準時間の2倍を返すこと", () => {
    const speedZeroScoreMs = calculateTakuzuSpeedZeroScoreMs(lightWorkload);

    expect(speedZeroScoreMs).toBe(lightFullScoreMs * 2);
  });
});

describe("calculateTakuzuTimeDeltaMs", () => {
  const cases = [
    ["基準時間より速い", lightFullScoreMs - 12_000, -12_000],
    ["基準時間より遅い", lightFullScoreMs + 30_000, 30_000],
  ] as const;

  test.each(cases)(
    "%s クリア時間から、基準時間との差を返すこと",
    (_, elapsedMs, expected) => {
      const timeDeltaMs = calculateTakuzuTimeDeltaMs({
        elapsedMs,
        workload: lightWorkload,
      });

      expect(timeDeltaMs).toBe(expected);
    },
  );
});

describe("calculateTakuzuPlayScore", () => {
  describe("置き直しも盤面を戻すこともなく基準時間内に解いた場合", () => {
    const play = {
      elapsedMs: lightFullScoreMs,
      correctionCount: 0,
      restartCount: 0,
      undoCount: 0,
      workload: lightWorkload,
    };

    test("正確性60点と速さ40点の満点にすること", () => {
      const score = calculateTakuzuPlayScore(play);

      expect(score).toEqual({
        total: 100,
        breakdown: { accuracy: 60, speed: 40 },
      });
    });
  });

  const accuracyCases = [
    ["置き直し2回・盤面を戻した回数1回・待った3回", 2, 1, 3, 29],
    ["置き直し30回・盤面を戻した回数3回・待った0回", 30, 3, 0, 0],
  ] as const;

  test.each(accuracyCases)(
    "%s で、置き直し1回につき5点・盤面を戻した1回につき15点・待った1回につき2点を0点を下限に減点すること",
    (_, correctionCount, restartCount, undoCount, expected) => {
      const score = calculateTakuzuPlayScore({
        elapsedMs: lightFullScoreMs,
        correctionCount,
        restartCount,
        undoCount,
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
      const score = calculateTakuzuPlayScore({
        elapsedMs: lightFullScoreMs * elapsedRatio,
        correctionCount: 0,
        restartCount: 0,
        undoCount: 0,
        workload: lightWorkload,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  describe("基準時間に対して同じ割合で解いた場合", () => {
    const play = { elapsedRatio: 1.3, correctionCount: 0, restartCount: 0 };

    test("作業の量が違う問題でも同じ点にすること", () => {
      const heavyScore = scorePlay(play, heavyWorkload);
      const lightScore = scorePlay(play, lightWorkload);

      expect(heavyScore).toBe(lightScore);
    });
  });
});

describe("代表的なプレイ例", () => {
  const plays = {
    fastClean: { elapsedRatio: 0.8, correctionCount: 0, restartCount: 0 },
    slightlySlowClean: {
      elapsedRatio: 1.2,
      correctionCount: 0,
      restartCount: 0,
    },
    slowClean: { elapsedRatio: 1.4, correctionCount: 0, restartCount: 0 },
    verySlowClean: { elapsedRatio: 2.5, correctionCount: 0, restartCount: 0 },
    oneMistap: { elapsedRatio: 0.9, correctionCount: 1, restartCount: 0 },
    oneMistapUndone: {
      elapsedRatio: 0.9,
      correctionCount: 0,
      restartCount: 0,
      undoCount: 1,
    },
    twoCorrections: { elapsedRatio: 1, correctionCount: 2, restartCount: 0 },
    threeCorrections: { elapsedRatio: 1, correctionCount: 3, restartCount: 0 },
    oneTrialChain: { elapsedRatio: 1.2, correctionCount: 4, restartCount: 0 },
    fastGuessing: { elapsedRatio: 0.6, correctionCount: 6, restartCount: 0 },
    heavyGuessing: { elapsedRatio: 1.5, correctionCount: 10, restartCount: 0 },
    cleanRestart: { elapsedRatio: 1, correctionCount: 0, restartCount: 1 },
    restartAfterStuck: {
      elapsedRatio: 1.5,
      correctionCount: 1,
      restartCount: 1,
    },
  } satisfies Record<string, PlayExample>;

  const levelCases = [
    ["速く、置き直しなし", plays.fastClean, "perfect"],
    ["少し遅いが、置き直しなし", plays.slightlySlowClean, "great"],
    ["押し間違いを1回直した", plays.oneMistap, "great"],
    ["押し間違いを待ったで1回取り消した", plays.oneMistapUndone, "great"],
    ["置き直し2回", plays.twoCorrections, "great"],
    ["遅いが、置き直しなし", plays.slowClean, "good"],
    ["置き直し3回", plays.threeCorrections, "good"],
    ["置き直しなしで、盤面を1回戻した", plays.cleanRestart, "good"],
    ["試し置きを1回たどって4マス直した", plays.oneTrialChain, "clear"],
    ["速いが、試し置きで6マス直した", plays.fastGuessing, "clear"],
    ["とても遅い", plays.verySlowClean, "clear"],
    ["行き詰まって盤面を戻した", plays.restartAfterStuck, "clear"],
  ] as const;

  test.each(levelCases)("%s プレイを %s にすること", (_, play, level) => {
    const resultLevel = getGameResultLevel(scorePlay(play));

    expect(resultLevel).toBe(level);
  });

  const higherCases = [
    [
      "押し間違いを待ったで取り消した",
      plays.oneMistapUndone,
      "同じ押し間違いを置き直した",
      plays.oneMistap,
    ],
    [
      "置き直しなしで少し遅い",
      plays.slightlySlowClean,
      "速いが試し置きで何マスも直した",
      plays.fastGuessing,
    ],
    [
      "置き直しなしで遅い",
      plays.slowClean,
      "速いが試し置きで何マスも直した",
      plays.fastGuessing,
    ],
    [
      "とても遅くても置き直しなしで解き切った",
      plays.verySlowClean,
      "試し置きを重ねた",
      plays.heavyGuessing,
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
    const correctionCounts = [0, 1, 2, 3, 6, 12];

    test("置き直しが多いほど評価を下げること", () => {
      const scores = correctionCounts.map((correctionCount) =>
        scorePlay({ elapsedRatio: 1, correctionCount, restartCount: 0 }),
      );

      expect(scores).toEqual([...scores].sort((left, right) => right - left));
      expect(new Set(scores).size).toBe(scores.length);
    });
  });
});

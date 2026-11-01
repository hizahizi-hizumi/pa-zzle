import type { NonogramSolveWorkload } from "@/games/nonogram/problem/problem";
import {
  calculateNonogramPlayScore,
  calculateNonogramSpeedFullScoreMs,
  calculateNonogramSpeedScoreRule,
  calculateNonogramTimeDeltaMs,
} from "@/games/nonogram/score";
import { getGameResultLevel } from "@/games/result";

// レベル 1 と レベル 5 の問題集の中央値に近い作業の量。
const lightWorkload: NonogramSolveWorkload = {
  width: 8,
  height: 8,
  filledCellCount: 33,
  roundCount: 3,
};
const heavyWorkload: NonogramSolveWorkload = {
  width: 10,
  height: 13,
  filledCellCount: 58,
  roundCount: 14,
};

const lightFullScoreMs = 81_750;
const heavyFullScoreMs = 169_500;

type PlayExample = {
  elapsedRatio: number;
  repaintCount: number;
};

function scorePlay(
  { elapsedRatio, repaintCount }: PlayExample,
  workload: NonogramSolveWorkload = lightWorkload,
): number {
  return calculateNonogramPlayScore({
    elapsedMs: calculateNonogramSpeedFullScoreMs(workload) * elapsedRatio,
    repaintCount,
    workload,
  }).total;
}

describe("calculateNonogramSpeedFullScoreMs", () => {
  const cases = [
    ["小さく連鎖の浅い問題", lightWorkload, lightFullScoreMs],
    ["広く連鎖の深い問題", heavyWorkload, heavyFullScoreMs],
  ] as const;

  test.each(cases)(
    "%s で、盤面把握10秒に行・列1本2秒・塗るマス1つ0.75秒・連鎖の1段5秒を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateNonogramSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("連鎖の段の数だけが違う問題の場合", () => {
    const shallow = { ...heavyWorkload, roundCount: 12 };

    test("連鎖の深い方の基準時間を長くすること", () => {
      const deepMs = calculateNonogramSpeedFullScoreMs(heavyWorkload);
      const shallowMs = calculateNonogramSpeedFullScoreMs(shallow);

      expect(deepMs).toBeGreaterThan(shallowMs);
    });
  });
});

describe("calculateNonogramSpeedScoreRule", () => {
  test("基準時間の3倍で0点になる規則を返すこと", () => {
    const rule = calculateNonogramSpeedScoreRule(lightWorkload);

    expect(rule).toEqual({
      fullScoreMs: lightFullScoreMs,
      zeroScoreMs: lightFullScoreMs * 3,
    });
  });
});

describe("calculateNonogramTimeDeltaMs", () => {
  const cases = [
    ["基準時間より速い", lightFullScoreMs - 12_000, -12_000],
    ["基準時間より遅い", lightFullScoreMs + 30_000, 30_000],
  ] as const;

  test.each(cases)(
    "%s クリア時間から、基準時間との差を返すこと",
    (_, elapsedMs, expected) => {
      const timeDeltaMs = calculateNonogramTimeDeltaMs({
        elapsedMs,
        workload: lightWorkload,
      });

      expect(timeDeltaMs).toBe(expected);
    },
  );
});

describe("calculateNonogramPlayScore", () => {
  describe("塗り直しなしで基準時間内に解いた場合", () => {
    test("速さ85点と正確さ15点の満点にすること", () => {
      const score = calculateNonogramPlayScore({
        elapsedMs: lightFullScoreMs,
        repaintCount: 0,
        workload: lightWorkload,
      });

      expect(score).toEqual({
        total: 100,
        breakdown: { speed: 85, accuracy: 15 },
      });
    });
  });

  const accuracyCases = [
    [1, 12],
    [2, 9],
    [4, 3],
    [5, 0],
    [12, 0],
  ] as const;

  test.each(accuracyCases)(
    "塗り直し %s マスで、1マスにつき3点を0点を下限に減らし、正確さを %s 点にすること",
    (repaintCount, expected) => {
      const score = calculateNonogramPlayScore({
        elapsedMs: lightFullScoreMs,
        repaintCount,
        workload: lightWorkload,
      });

      expect(score.breakdown.accuracy).toBe(expected);
    },
  );

  const speedCases = [
    [0.5, 85],
    [1.4, 68],
    [2, 43],
    [3, 0],
    [4, 0],
  ] as const;

  test.each(speedCases)(
    "基準時間の %s 倍で解いたプレイの速さを %s 点にすること",
    (elapsedRatio, expected) => {
      const score = calculateNonogramPlayScore({
        elapsedMs: lightFullScoreMs * elapsedRatio,
        repaintCount: 0,
        workload: lightWorkload,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  describe("基準時間に対して同じ割合で解いた場合", () => {
    const play = { elapsedRatio: 1.3, repaintCount: 0 };

    test("作業の量が違う問題でも同じ点にすること", () => {
      const heavyScore = scorePlay(play, heavyWorkload);
      const lightScore = scorePlay(play, lightWorkload);

      expect(heavyScore).toBe(lightScore);
    });
  });
});

describe("代表的なプレイ例", () => {
  const plays = {
    fastClean: { elapsedRatio: 0.9, repaintCount: 0 },
    slightlySlowClean: { elapsedRatio: 1.2, repaintCount: 0 },
    slowClean: { elapsedRatio: 1.4, repaintCount: 0 },
    verySlowClean: { elapsedRatio: 2, repaintCount: 0 },
    oneMistap: { elapsedRatio: 1, repaintCount: 1 },
    twoRepaints: { elapsedRatio: 1, repaintCount: 2 },
    fastTrialFill: { elapsedRatio: 0.6, repaintCount: 8 },
    slowTrialFill: { elapsedRatio: 1.2, repaintCount: 10 },
  } satisfies Record<string, PlayExample>;

  const levelCases = [
    ["速く、塗り直しなし", plays.fastClean, "perfect"],
    ["少し遅いが、塗り直しなし", plays.slightlySlowClean, "great"],
    ["押し間違いを1マス塗り直した", plays.oneMistap, "great"],
    ["2マス塗り直した", plays.twoRepaints, "great"],
    ["遅いが、塗り直しなし", plays.slowClean, "good"],
    ["速いが、試し塗りで8マス塗り直した", plays.fastTrialFill, "good"],
    ["とても遅い", plays.verySlowClean, "clear"],
    ["試し塗りで10マス塗り直し、遅い", plays.slowTrialFill, "clear"],
  ] as const;

  test.each(levelCases)("%s プレイを %s にすること", (_, play, level) => {
    const resultLevel = getGameResultLevel(scorePlay(play));

    expect(resultLevel).toBe(level);
  });

  describe("塗り直しなしで少し遅いプレイと、速いが試し塗りで何マスも塗り直したプレイの場合", () => {
    test("塗り直しなしのプレイを高く評価すること", () => {
      const cleanScore = scorePlay(plays.slightlySlowClean);
      const trialFillScore = scorePlay(plays.fastTrialFill);

      expect(cleanScore).toBeGreaterThan(trialFillScore);
    });
  });

  describe("同じ速さで塗り直したマスの数だけが違う場合", () => {
    const repaintCounts = [0, 1, 2, 3, 4, 5];

    test("塗り直しが多いほど評価を下げること", () => {
      const scores = repaintCounts.map((repaintCount) =>
        scorePlay({ elapsedRatio: 1, repaintCount }),
      );

      expect(scores).toEqual([...scores].sort((left, right) => right - left));
      expect(new Set(scores).size).toBe(scores.length);
    });
  });
});

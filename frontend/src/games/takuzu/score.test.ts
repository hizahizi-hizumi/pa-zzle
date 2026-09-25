import type { TakuzuSolveWorkload } from "@/games/takuzu/problem/problem";
import {
  calculateTakuzuPlayScore,
  calculateTakuzuSpeedFullScoreMs,
  calculateTakuzuTimeDeltaMs,
  getTakuzuGameResultLevel,
} from "@/games/takuzu/score";

// 難易度1 と 難易度5 の問題集の中央値に近い作業の量。
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
};

function scorePlay(
  { elapsedRatio, correctionCount, restartCount }: PlayExample,
  workload: TakuzuSolveWorkload = lightWorkload,
): number {
  return calculateTakuzuPlayScore({
    elapsedMs: calculateTakuzuSpeedFullScoreMs(workload) * elapsedRatio,
    correctionCount,
    restartCount,
    workload,
  }).total;
}

describe("calculateTakuzuSpeedFullScoreMs", () => {
  test("盤面把握10秒に、空きマス1つ2秒・局面1つ3秒・行と列を読む局面1つ10秒を足すこと", () => {
    expect(calculateTakuzuSpeedFullScoreMs(lightWorkload)).toBe(
      lightFullScoreMs,
    );
    expect(calculateTakuzuSpeedFullScoreMs(heavyWorkload)).toBe(
      heavyFullScoreMs,
    );
  });

  test("行・列を読む局面が多い問題ほど、空きマスが同じでも基準時間を長くすること", () => {
    const withoutLineReading = calculateTakuzuSpeedFullScoreMs({
      ...heavyWorkload,
      lineReadingRoundCount: 0,
    });

    expect(calculateTakuzuSpeedFullScoreMs(heavyWorkload)).toBeGreaterThan(
      withoutLineReading,
    );
  });
});

describe("calculateTakuzuTimeDeltaMs", () => {
  test("基準時間より速ければ負、遅ければ正の差を返すこと", () => {
    expect(
      calculateTakuzuTimeDeltaMs({
        elapsedMs: lightFullScoreMs - 12_000,
        workload: lightWorkload,
      }),
    ).toBe(-12_000);
    expect(
      calculateTakuzuTimeDeltaMs({
        elapsedMs: lightFullScoreMs + 30_000,
        workload: lightWorkload,
      }),
    ).toBe(30_000);
  });
});

describe("calculateTakuzuPlayScore", () => {
  test("置き直し・やり直しなしで基準時間内に解けば、正確さ60点と速さ40点の満点になること", () => {
    const score = calculateTakuzuPlayScore({
      elapsedMs: lightFullScoreMs,
      correctionCount: 0,
      restartCount: 0,
      workload: lightWorkload,
    });

    expect(score).toEqual({
      total: 100,
      breakdown: { accuracy: 60, speed: 40 },
    });
  });

  test("置き直し1回で5点、やり直し1回で15点を正確さから減点すること", () => {
    const score = calculateTakuzuPlayScore({
      elapsedMs: lightFullScoreMs,
      correctionCount: 2,
      restartCount: 1,
      workload: lightWorkload,
    });

    expect(score.breakdown.accuracy).toBe(35);
  });

  test("正確さを0点より下げないこと", () => {
    const score = calculateTakuzuPlayScore({
      elapsedMs: lightFullScoreMs,
      correctionCount: 30,
      restartCount: 3,
      workload: lightWorkload,
    });

    expect(score.breakdown.accuracy).toBe(0);
  });

  test("速さを基準時間の超過に応じて線形に減らし、2倍で0点にすること", () => {
    const speedAt = (elapsedRatio: number) =>
      calculateTakuzuPlayScore({
        elapsedMs: lightFullScoreMs * elapsedRatio,
        correctionCount: 0,
        restartCount: 0,
        workload: lightWorkload,
      }).breakdown.speed;

    expect(speedAt(0.5)).toBe(40);
    expect(speedAt(1.25)).toBe(30);
    expect(speedAt(1.5)).toBe(20);
    expect(speedAt(2)).toBe(0);
    expect(speedAt(3)).toBe(0);
  });

  test("基準時間に対して同じ割合で解けば、作業の量が違う問題でも同じ速さの点になること", () => {
    const play = { elapsedRatio: 1.3, correctionCount: 0, restartCount: 0 };

    expect(scorePlay(play, heavyWorkload)).toBe(scorePlay(play, lightWorkload));
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

  test.each([
    ["速く、置き直しなし", plays.fastClean, "perfect"],
    ["少し遅いが、置き直しなし", plays.slightlySlowClean, "great"],
    ["押し間違いを1回直した", plays.oneMistap, "great"],
    ["置き直し2回", plays.twoCorrections, "great"],
    ["遅いが、置き直しなし", plays.slowClean, "good"],
    ["置き直し3回", plays.threeCorrections, "good"],
    ["置き直しなしで、1回やり直した", plays.cleanRestart, "good"],
    ["試し置きを1回たどって4マス直した", plays.oneTrialChain, "clear"],
    ["速いが、試し置きで6マス直した", plays.fastGuessing, "clear"],
    ["とても遅い", plays.verySlowClean, "clear"],
    ["行き詰まってやり直した", plays.restartAfterStuck, "clear"],
  ] as const)("%s プレイを %s にすること", (_, play, level) => {
    expect(getTakuzuGameResultLevel(scorePlay(play))).toBe(level);
  });

  test("置き直しなしで少し遅いプレイを、速いが試し置きで何マスも直したプレイより高く評価すること", () => {
    expect(scorePlay(plays.slightlySlowClean)).toBeGreaterThan(
      scorePlay(plays.fastGuessing),
    );
    expect(scorePlay(plays.slowClean)).toBeGreaterThan(
      scorePlay(plays.fastGuessing),
    );
  });

  test("遅くても置き直しなしで解き切ったプレイを、試し置きを重ねたプレイより高く評価すること", () => {
    expect(scorePlay(plays.verySlowClean)).toBeGreaterThan(
      scorePlay(plays.heavyGuessing),
    );
  });

  test("同じ速さなら、置き直しが多いほど評価を下げること", () => {
    const scores = [0, 1, 2, 3, 6, 12].map((correctionCount) =>
      scorePlay({ elapsedRatio: 1, correctionCount, restartCount: 0 }),
    );

    expect(scores).toEqual([...scores].sort((left, right) => right - left));
    expect(new Set(scores).size).toBe(scores.length);
  });
});

describe("getTakuzuGameResultLevel", () => {
  test.each([
    [100, "perfect"],
    [99, "great"],
    [90, "great"],
    [89, "good"],
    [80, "good"],
    [79, "clear"],
    [0, "clear"],
  ] as const)("%i 点を %s にすること", (score, level) => {
    expect(getTakuzuGameResultLevel(score)).toBe(level);
  });
});

import type { HamiltonianPathSolveWorkload } from "@/games/hamiltonian-path/problem/problem";
import {
  calculateHamiltonianPathPlayScore,
  calculateHamiltonianPathSpeedFullScoreMs,
  calculateHamiltonianPathSpeedScoreRule,
  calculateHamiltonianPathTimeDeltaMs,
} from "@/games/hamiltonian-path/score";
import { getGameResultLevel } from "@/games/result";

// レベル1 と レベル5 の問題集の中央値に近い作業の量。
const lightWorkload: HamiltonianPathSolveWorkload = {
  openCellCount: 25,
  assumptionCount: 0,
  refutationStepCount: 0,
  longestRefutationLength: 0,
  fatalBranchCount: 3,
};
const heavyWorkload: HamiltonianPathSolveWorkload = {
  openCellCount: 64,
  assumptionCount: 8,
  refutationStepCount: 71,
  longestRefutationLength: 18,
  fatalBranchCount: 13,
};

const lightFullScoreMs = 26_500;
const heavyFullScoreMs = 171_000;

type PlayExample = {
  elapsedRatio: number;
  backtrackCount: number;
};

function scorePlay({ elapsedRatio, backtrackCount }: PlayExample): number {
  return calculateHamiltonianPathPlayScore({
    elapsedMs: heavyFullScoreMs * elapsedRatio,
    backtrackCount,
    workload: heavyWorkload,
  }).total;
}

describe("calculateHamiltonianPathSpeedFullScoreMs", () => {
  const cases = [
    ["仮置きの要らない小さな盤面", lightWorkload, lightFullScoreMs],
    ["仮置きを重ねる大きな盤面", heavyWorkload, heavyFullScoreMs],
  ] as const;

  test.each(cases)(
    "%sで、見渡す5秒になぞるマス1つ0.5秒・迷う分岐1つ3秒・仮置き1回3秒・先読み1手1秒を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs =
        calculateHamiltonianPathSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("先読みの手数の合計が上限を超える問題の場合", () => {
    const atLimit = { ...heavyWorkload, refutationStepCount: 120 };
    const overLimit = { ...heavyWorkload, refutationStepCount: 287 };

    test("上限の120手までだけを数えること", () => {
      const atLimitMs = calculateHamiltonianPathSpeedFullScoreMs(atLimit);
      const overLimitMs = calculateHamiltonianPathSpeedFullScoreMs(overLimit);

      expect(overLimitMs).toBe(atLimitMs);
      expect(atLimitMs).toBe(220_000);
    });
  });
});

describe("calculateHamiltonianPathSpeedScoreRule", () => {
  test("基準時間の3倍で0点になる規則を返すこと", () => {
    const rule = calculateHamiltonianPathSpeedScoreRule(lightWorkload);

    expect(rule).toEqual({
      fullScoreMs: lightFullScoreMs,
      zeroScoreMs: lightFullScoreMs * 3,
    });
  });
});

describe("calculateHamiltonianPathTimeDeltaMs", () => {
  const cases = [
    ["基準時間より速い", lightFullScoreMs - 6_500, -6_500],
    ["基準時間より遅い", lightFullScoreMs + 30_000, 30_000],
  ] as const;

  test.each(cases)(
    "%sクリア時間から、基準時間との差を返すこと",
    (_, elapsedMs, expected) => {
      const timeDeltaMs = calculateHamiltonianPathTimeDeltaMs({
        elapsedMs,
        workload: lightWorkload,
      });

      expect(timeDeltaMs).toBe(expected);
    },
  );
});

describe("calculateHamiltonianPathPlayScore", () => {
  describe("引き直しなしで基準時間内に解いた場合", () => {
    const play = {
      elapsedMs: heavyFullScoreMs,
      backtrackCount: 0,
      workload: heavyWorkload,
    };

    test("速さ60点と正確さ40点の満点にすること", () => {
      const score = calculateHamiltonianPathPlayScore(play);

      expect(score).toEqual({
        total: 100,
        breakdown: { speed: 60, accuracy: 40 },
      });
    });
  });

  describe("基準時間の2倍かかり、引き直しを5回した場合", () => {
    const play = {
      elapsedMs: heavyFullScoreMs * 2,
      backtrackCount: 5,
      workload: heavyWorkload,
    };

    test("速さを超過時間に比例して減らし、正確さを引き直し1回3点ずつ減らすこと", () => {
      const score = calculateHamiltonianPathPlayScore(play);

      expect(score).toEqual({
        total: 55,
        breakdown: { speed: 30, accuracy: 25 },
      });
    });
  });

  describe("基準時間の3倍以上かかり、引き直しを14回以上した場合", () => {
    const play = {
      elapsedMs: heavyFullScoreMs * 4,
      backtrackCount: 20,
      workload: heavyWorkload,
    };

    test("どちらも0点を下回らないこと", () => {
      const score = calculateHamiltonianPathPlayScore(play);

      expect(score).toEqual({ total: 0, breakdown: { speed: 0, accuracy: 0 } });
    });
  });

  describe("評価段階", () => {
    const cases = [
      [
        "基準時間内で引き直しなし",
        "perfect",
        { elapsedRatio: 1, backtrackCount: 0 },
      ],
      [
        "基準時間内で押し間違いを3回直した",
        "great",
        { elapsedRatio: 1, backtrackCount: 3 },
      ],
      [
        "基準時間の1.2倍で引き直しなし",
        "great",
        { elapsedRatio: 1.2, backtrackCount: 0 },
      ],
      [
        "基準時間の1.5倍で引き直し1回",
        "good",
        { elapsedRatio: 1.5, backtrackCount: 1 },
      ],
      [
        "基準時間内で引き直し4回",
        "good",
        { elapsedRatio: 1, backtrackCount: 4 },
      ],
      [
        "基準時間の2倍で引き直しなし",
        "clear",
        { elapsedRatio: 2, backtrackCount: 0 },
      ],
    ] as const;

    test.each(cases)("%sのプレイを %s にすること", (_, expected, play) => {
      const level = getGameResultLevel(scorePlay(play));

      expect(level).toBe(expected);
    });
  });
});

import { getGameResultLevel } from "@/games/result";
import type { TsumeShogiSolveWorkload } from "@/games/tsume-shogi/problem/problem";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiSpeedFullScoreMs,
  calculateTsumeShogiSpeedZeroScoreMs,
  calculateTsumeShogiTimeDeltaMs,
  countTsumeShogiAttackerMoves,
} from "@/games/tsume-shogi/score";

// 誤王手の紛れの無い3手詰と、もっともらしい誤王手・深い紛れがどちらも上限を超える5手詰（問題集のレベル5 の最大）の作業の量。
const lightWorkload: TsumeShogiSolveWorkload = {
  plies: 3,
  rootChecks: 3,
  plausibleWrong: 0,
  deepDecoyCount: 0,
};
const heavyWorkload: TsumeShogiSolveWorkload = {
  plies: 5,
  rootChecks: 14,
  plausibleWrong: 41,
  deepDecoyCount: 26,
};

// 8秒 + 攻方2手 × 4秒 + 王手3 × 2秒。
const lightFullScoreMs = 22_000;
// 8秒 + 攻方3手 × 4秒 + 王手14 × 2秒 + もっともらしい誤王手20（上限） × 4秒 + 深い紛れ10（上限） × 6秒。
const heavyFullScoreMs = 188_000;

function scoreAt(
  elapsedRatio: number,
  wrongCheckCount = 0,
  workload: TsumeShogiSolveWorkload = lightWorkload,
): number {
  return calculateTsumeShogiPlayScore({
    elapsedMs: calculateTsumeShogiSpeedFullScoreMs(workload) * elapsedRatio,
    wrongCheckCount,
    workload,
  }).total;
}

describe("countTsumeShogiAttackerMoves", () => {
  const cases = [
    [1, 1],
    [3, 2],
    [5, 3],
  ] as const;

  test.each(cases)("%i手詰の攻方の手を %i手と数えること", (plies, expected) => {
    const moves = countTsumeShogiAttackerMoves(plies);

    expect(moves).toBe(expected);
  });
});

describe("calculateTsumeShogiSpeedFullScoreMs", () => {
  const cases = [
    ["誤王手の紛れの無い3手詰", lightWorkload, lightFullScoreMs],
    [
      "もっともらしい誤王手と深い紛れが上限を超える5手詰",
      heavyWorkload,
      heavyFullScoreMs,
    ],
  ] as const;

  test.each(cases)(
    "%s で、8秒に攻方の1手4秒・初手の王手1つ2秒・もっともらしい誤王手1つ4秒（20まで）・深い紛れ1つ6秒（10まで）を足すこと",
    (_, workload, expected) => {
      const speedFullScoreMs = calculateTsumeShogiSpeedFullScoreMs(workload);

      expect(speedFullScoreMs).toBe(expected);
    },
  );

  describe("もっともらしい誤王手と深い紛れだけが上限の前後で違う場合", () => {
    const atLimit = {
      ...heavyWorkload,
      plausibleWrong: 20,
      deepDecoyCount: 10,
    };

    test("上限を超えた分は基準時間を伸ばさないこと", () => {
      const atLimitMs = calculateTsumeShogiSpeedFullScoreMs(atLimit);
      const overLimitMs = calculateTsumeShogiSpeedFullScoreMs(heavyWorkload);

      expect(overLimitMs).toBe(atLimitMs);
    });
  });

  describe("深い紛れの数だけが違う場合", () => {
    const fewerDecoys = { ...heavyWorkload, deepDecoyCount: 3 };

    test("深い紛れが多い方の基準時間を長くすること", () => {
      const moreDecoysMs = calculateTsumeShogiSpeedFullScoreMs(heavyWorkload);
      const fewerDecoysMs = calculateTsumeShogiSpeedFullScoreMs(fewerDecoys);

      expect(moreDecoysMs).toBeGreaterThan(fewerDecoysMs);
    });
  });

  describe("手数だけが違う場合", () => {
    const fivePly = { ...lightWorkload, plies: 5 };

    test("攻方の手が多い5手詰の基準時間を4秒長くすること", () => {
      const difference =
        calculateTsumeShogiSpeedFullScoreMs(fivePly) -
        calculateTsumeShogiSpeedFullScoreMs(lightWorkload);

      expect(difference).toBe(4_000);
    });
  });
});

describe("calculateTsumeShogiSpeedZeroScoreMs", () => {
  test("基準時間の3倍を返すこと", () => {
    const speedZeroScoreMs = calculateTsumeShogiSpeedZeroScoreMs(lightWorkload);

    expect(speedZeroScoreMs).toBe(lightFullScoreMs * 3);
  });
});

describe("calculateTsumeShogiTimeDeltaMs", () => {
  const cases = [
    ["基準時間より速い", lightFullScoreMs - 5_000, -5_000],
    ["基準時間より遅い", lightFullScoreMs + 12_000, 12_000],
  ] as const;

  test.each(cases)(
    "%s クリア時間から、基準時間との差を返すこと",
    (_, elapsedMs, expected) => {
      const timeDeltaMs = calculateTsumeShogiTimeDeltaMs({
        elapsedMs,
        workload: lightWorkload,
      });

      expect(timeDeltaMs).toBe(expected);
    },
  );
});

describe("calculateTsumeShogiPlayScore", () => {
  describe("誤王手を指さなかったプレイ", () => {
    const cases = [
      [0.5, 100, "perfect"],
      [1, 100, "perfect"],
      [1.2, 92, "great"],
      [1.25, 90, "great"],
      [1.4, 84, "good"],
      [1.5, 80, "good"],
      [2, 60, "clear"],
      [3, 20, "clear"],
      [4, 20, "clear"],
    ] as const;

    test.each(cases)(
      "基準時間の %f 倍で %i点（%s）にすること",
      (ratio, expectedScore, expectedLevel) => {
        const score = scoreAt(ratio);

        expect(score).toBe(expectedScore);
        expect(getGameResultLevel(score)).toBe(expectedLevel);
      },
    );
  });

  describe("基準時間以内に詰ませたプレイ", () => {
    const cases = [
      [1, 95, "great"],
      [2, 90, "great"],
      [3, 85, "good"],
      [4, 80, "good"],
      [13, 80, "good"],
    ] as const;

    test.each(cases)(
      "誤王手 %i回で %i点（%s）にし、読みの確かさの20点を超えては減らさないこと",
      (wrongCheckCount, expectedScore, expectedLevel) => {
        const score = scoreAt(1, wrongCheckCount);

        expect(score).toBe(expectedScore);
        expect(getGameResultLevel(score)).toBe(expectedLevel);
      },
    );
  });

  test("読みの確かさと速さの内訳を返すこと", () => {
    const score = calculateTsumeShogiPlayScore({
      elapsedMs: lightFullScoreMs * 1.2,
      wrongCheckCount: 1,
      workload: lightWorkload,
    });

    expect(score).toEqual({
      total: 87,
      breakdown: { accuracy: 15, speed: 72 },
    });
  });

  test("作業の量が違う問題でも、同じ倍率と誤王手の回数なら同じ点にすること", () => {
    const light = scoreAt(1.3, 1, lightWorkload);
    const heavy = scoreAt(1.3, 1, heavyWorkload);

    expect(heavy).toBe(light);
  });

  test("同じ時間なら、誤王手の少ない方を高くすること", () => {
    const withoutWrongCheck = scoreAt(1.1, 0);
    const withWrongCheck = scoreAt(1.1, 1);

    expect(withoutWrongCheck).toBeGreaterThan(withWrongCheck);
  });
});

import {
  calculateParkingJamPlayScore,
  getParkingJamGameResultLevel,
  PARKING_JAM_SCORE_MAXIMUMS,
  PARKING_JAM_SPEED_FULL_SCORE_MS,
  type ParkingJamPlayScoreInput,
} from "./score";

describe("calculateParkingJamPlayScore", () => {
  const perfectInput: ParkingJamPlayScoreInput = {
    difficulty: "normal",
    elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal,
    failedMoveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };

  test("不成立操作も待ったもやり直しもなく基準時間内なら100点になること", () => {
    const score = calculateParkingJamPlayScore(perfectInput);

    expect(score).toEqual({
      total: 100,
      breakdown: {
        accuracy: PARKING_JAM_SCORE_MAXIMUMS.accuracy,
        speed: PARKING_JAM_SCORE_MAXIMUMS.speed,
        stability: PARKING_JAM_SCORE_MAXIMUMS.stability,
      },
    });
  });

  describe("出せない方向を選んだ場合", () => {
    const input: ParkingJamPlayScoreInput = {
      ...perfectInput,
      failedMoveCount: 3,
    };

    test("1回につき正確さを5点減点すること", () => {
      const score = calculateParkingJamPlayScore(input);

      expect(score.breakdown.accuracy).toBe(25);
      expect(score.total).toBe(85);
    });
  });

  describe("基準時間を超えてクリアした場合", () => {
    const cases = [
      [
        {
          ...perfectInput,
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 1.25,
        },
        30,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 1.5,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 2,
        },
        0,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 3,
        },
        0,
      ],
    ] as const satisfies readonly (readonly [
      ParkingJamPlayScoreInput,
      number,
    ])[];

    test.each(cases)(
      "超過時間に応じて速さを線形に減点すること",
      (input, expectedSpeed) => {
        const score = calculateParkingJamPlayScore(input);

        expect(score.breakdown.speed).toBe(expectedSpeed);
      },
    );
  });

  describe("難易度が異なる場合", () => {
    const cases = [
      [
        {
          ...perfectInput,
          difficulty: "easy",
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.easy * 1.5,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          difficulty: "normal",
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 1.5,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          difficulty: "hard",
          elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.hard * 1.5,
        },
        20,
      ],
    ] as const satisfies readonly (readonly [
      ParkingJamPlayScoreInput,
      number,
    ])[];

    test.each(cases)(
      "基準時間に対する倍率が同じなら同じ速さになること",
      (input, expectedSpeed) => {
        const score = calculateParkingJamPlayScore(input);

        expect(score.breakdown.speed).toBe(expectedSpeed);
      },
    );
  });

  describe("待ったとやり直しを使った場合", () => {
    const input: ParkingJamPlayScoreInput = {
      ...perfectInput,
      undoCount: 3,
      restartCount: 1,
    };

    test("安定性からそれぞれ減点すること", () => {
      const score = calculateParkingJamPlayScore(input);

      expect(score.breakdown.stability).toBe(9);
      expect(score.total).toBe(89);
    });
  });

  describe("大きな減点が発生した場合", () => {
    const input: ParkingJamPlayScoreInput = {
      ...perfectInput,
      elapsedMs: PARKING_JAM_SPEED_FULL_SCORE_MS.normal * 3,
      failedMoveCount: 100,
      undoCount: 100,
      restartCount: 100,
    };

    test("各評価軸を0点未満にしないこと", () => {
      const score = calculateParkingJamPlayScore(input);

      expect(score).toEqual({
        total: 0,
        breakdown: { accuracy: 0, speed: 0, stability: 0 },
      });
    });
  });
});

describe("getParkingJamGameResultLevel", () => {
  const cases = [
    [100, "perfect"],
    [90, "great"],
    [80, "good"],
    [79, "clear"],
  ] as const;

  test.each(cases)("評価点 %i を %s 段階として扱うこと", (score, expected) => {
    const level = getParkingJamGameResultLevel(score);

    expect(level).toBe(expected);
  });
});

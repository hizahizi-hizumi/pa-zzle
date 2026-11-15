import { createParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  calculateParkingJamPlayScore,
  calculateParkingJamSpeedFullScoreMs,
  calculateParkingJamTimeDeltaMs,
  PARKING_JAM_SCORE_MAXIMUMS,
  type ParkingJamPlayScoreInput,
} from "@/games/parking-jam/score";
import type { ParkingJamSessionResult } from "@/games/parking-jam/session/session";

describe("calculateParkingJamSpeedFullScoreMs", () => {
  const cases = [
    [{ vehicleCount: 8, initialBlockedVehicleCount: 2 }, 35_000],
    [{ vehicleCount: 11, initialBlockedVehicleCount: 5 }, 53_000],
    [{ vehicleCount: 14, initialBlockedVehicleCount: 8 }, 71_000],
  ] as const;

  test.each(cases)(
    "盤面把握と車両数と初期に塞がれた車の数から基準時間を求めること: %o",
    (reference, expected) => {
      const speedFullScoreMs = calculateParkingJamSpeedFullScoreMs(reference);

      expect(speedFullScoreMs).toBe(expected);
    },
  );
});

describe("calculateParkingJamTimeDeltaMs", () => {
  test("問題ごとの基準時間とクリア時間との差を求めること", () => {
    const timeDeltaMs = calculateParkingJamTimeDeltaMs({
      elapsedMs: 30_000,
      speedReference: { vehicleCount: 8, initialBlockedVehicleCount: 2 },
    });

    expect(timeDeltaMs).toBe(-5_000);
  });
});

describe("calculateParkingJamPlayScore", () => {
  // 基準時間は 5 秒 + 9台 × 3 秒 + 6台 × 3 秒 = 50 秒。
  const speedReference = { vehicleCount: 9, initialBlockedVehicleCount: 6 };
  const speedFullScoreMs = 50_000;
  const perfectInput: ParkingJamPlayScoreInput = {
    speedReference,
    elapsedMs: speedFullScoreMs,
    failedMoveCount: 0,
  };

  test("不成立操作がなく基準時間内なら100点になること", () => {
    const score = calculateParkingJamPlayScore(perfectInput);

    expect(score).toEqual({
      total: 100,
      breakdown: {
        accuracy: PARKING_JAM_SCORE_MAXIMUMS.accuracy,
        speed: PARKING_JAM_SCORE_MAXIMUMS.speed,
      },
    });
  });

  describe("出せない方向を選んだ場合", () => {
    const input: ParkingJamPlayScoreInput = {
      ...perfectInput,
      failedMoveCount: 3,
    };

    test("1回につき正確さを10点減点すること", () => {
      const score = calculateParkingJamPlayScore(input);

      expect(score.breakdown.accuracy).toBe(30);
      expect(score.total).toBe(70);
    });
  });

  describe("基準時間を超えてクリアした場合", () => {
    const cases = [
      [
        {
          ...perfectInput,
          elapsedMs: speedFullScoreMs * 1.25,
        },
        30,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: speedFullScoreMs * 1.5,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: speedFullScoreMs * 2,
        },
        0,
      ],
      [
        {
          ...perfectInput,
          elapsedMs: speedFullScoreMs * 3,
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

  describe("基準時間が異なる問題の場合", () => {
    const cases = [
      [
        {
          ...perfectInput,
          speedReference: { vehicleCount: 8, initialBlockedVehicleCount: 2 },
          elapsedMs: 52_500,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          speedReference: { vehicleCount: 11, initialBlockedVehicleCount: 5 },
          elapsedMs: 79_500,
        },
        20,
      ],
      [
        {
          ...perfectInput,
          speedReference: { vehicleCount: 14, initialBlockedVehicleCount: 8 },
          elapsedMs: 106_500,
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

  describe("異なるプレイの優劣を比較する場合", () => {
    const cases = [
      ["出せない方向を一度選択", { ...perfectInput, failedMoveCount: 1 }, 90],
      ["出せない方向を二度選択", { ...perfectInput, failedMoveCount: 2 }, 80],
      [
        "ミスなく基準時間の1.25倍でクリア",
        { ...perfectInput, elapsedMs: speedFullScoreMs * 1.25 },
        90,
      ],
      [
        "ミスなく基準時間の1.5倍でクリア",
        { ...perfectInput, elapsedMs: speedFullScoreMs * 1.5 },
        80,
      ],
    ] as const satisfies readonly (readonly [
      string,
      ParkingJamPlayScoreInput,
      number,
    ])[];

    test.each(cases)(
      "ミスの数と経過時間に応じた評価点となること: %s",
      (_label, input, expected) => {
        const score = calculateParkingJamPlayScore(input);

        expect(score.total).toBe(expected);
        expect(Object.keys(score.breakdown)).toEqual(["accuracy", "speed"]);
      },
    );
  });

  describe("成立出庫を取り消すか選び直す場合", () => {
    const performance: ParkingJamSessionResult = {
      elapsedMs: speedFullScoreMs,
      moveAttemptCount: 9,
      successfulMoveCount: 9,
      failedMoveCount: 0,
      undoCount: 0,
      restartCount: 0,
    };
    const variants = [
      [
        "待った後に出庫し直す",
        {
          ...performance,
          successfulMoveCount: 10,
          moveAttemptCount: 10,
          undoCount: 1,
        },
      ],
      [
        "盤面を戻した後に出庫し直す",
        {
          ...performance,
          successfulMoveCount: 12,
          moveAttemptCount: 12,
          restartCount: 1,
        },
      ],
      ["車を選び直してから出庫する", performance],
    ] as const satisfies readonly (readonly [
      string,
      ParkingJamSessionResult,
    ])[];

    test.each(variants)(
      "成立した出庫の取り消しや選び直しだけでは減点しないこと: %s",
      (_label, variant) => {
        const result = createParkingJamResult(variant, speedReference);

        expect(result.score).toEqual({
          total: 100,
          breakdown: { accuracy: 60, speed: 40 },
        });
      },
    );
  });

  describe("大きな減点が発生した場合", () => {
    const input: ParkingJamPlayScoreInput = {
      ...perfectInput,
      elapsedMs: speedFullScoreMs * 3,
      failedMoveCount: 100,
    };

    test("各評価軸を0点未満にしないこと", () => {
      const score = calculateParkingJamPlayScore(input);

      expect(score).toEqual({
        total: 0,
        breakdown: { accuracy: 0, speed: 0 },
      });
    });
  });
});

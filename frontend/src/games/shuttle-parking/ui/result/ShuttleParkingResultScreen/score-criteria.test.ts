import type { ShuttleParkingResult } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import { getShuttleParkingScoreCriteria } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen/score-criteria";

describe("getShuttleParkingScoreCriteria", () => {
  // 車8台・乗客21人・罠の結果が6人先に出る問題。基準時間は 5秒 + 16秒 + 10.5秒 + 12秒 = 43.5秒。
  const result: ShuttleParkingResult = {
    elapsedMs: 60_000,
    exitCount: 9,
    blockedExitCount: 0,
    trapCount: 1,
    undoCount: 1,
    restartCount: 0,
    speedReference: { carCount: 8, passengerCount: 21, trapWeight: 6 },
    speedRule: { fullScoreMs: 43_500, zeroScoreMs: 87_000 },
    timeDeltaMs: 16_500,
    score: { total: 65, breakdown: { accuracy: 40, speed: 25 } },
  };

  test("正確さの基準に、全員を送り出せなくなる車を出した回数の減点を示すこと", () => {
    const [accuracy] = getShuttleParkingScoreCriteria(result);

    expect(accuracy?.description).toBe(
      "60点から、全員を送り出せなくなる車を出した1回につき20点を減らす。",
    );
  });

  test("速さの基準時間の式に、車・乗客・先読みの項を示すこと", () => {
    const [, speed] = getShuttleParkingScoreCriteria(result);

    expect(speed?.description).toContain(
      "基準時間は盤面把握5秒 + 車8台 × 2秒 + 乗客21人 × 0.5秒 + 先読み6人 × 2秒。",
    );
  });

  test("罠の無い問題では、先読みの項を出さないこと", () => {
    const [, speed] = getShuttleParkingScoreCriteria({
      ...result,
      speedReference: { ...result.speedReference, trapWeight: 0 },
    });

    expect(speed?.description).not.toContain("先読み");
  });
});

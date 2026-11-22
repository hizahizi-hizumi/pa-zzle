import type { ShuttleParkingResult } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import { getShuttleParkingScoreCriteria } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen/score-criteria";

describe("getShuttleParkingScoreCriteria", () => {
  // 車8台・乗客21人の問題。基準時間は 5秒 + 24秒 + 21秒 = 50秒。
  const result: ShuttleParkingResult = {
    elapsedMs: 60_000,
    exitCount: 9,
    blockedExitCount: 0,
    trapCount: 1,
    undoCount: 1,
    restartCount: 0,
    speedReference: { carCount: 8, passengerCount: 21 },
    speedRule: { fullScoreMs: 50_000, zeroScoreMs: 100_000 },
    timeDeltaMs: 10_000,
    score: { total: 72, breakdown: { accuracy: 40, speed: 32 } },
  };

  test("正確さの基準に、全員を送り出せなくなる車を出した回数の減点を示すこと", () => {
    const [accuracy] = getShuttleParkingScoreCriteria(result);

    expect(accuracy?.description).toBe(
      "60点から、全員を送り出せなくなる車を出した1回につき20点を減らす。",
    );
  });

  test("速さの基準時間の式に、車と乗客の項を示すこと", () => {
    const [, speed] = getShuttleParkingScoreCriteria(result);

    expect(speed?.description).toContain(
      "基準時間は盤面把握5秒 + 車8台 × 3秒 + 乗客21人 × 1秒。",
    );
  });
});

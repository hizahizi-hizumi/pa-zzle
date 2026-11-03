import type { IceFloorMazeResult } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { getIceFloorMazeScoreCriteria } from "@/games/ice-floor-maze/ui/result/IceFloorMazeResultScreen/score-criteria";

describe("getIceFloorMazeScoreCriteria", () => {
  // 描くマス99・もろい岩と薄い氷が7個・最短17手の問題。基準時間は 19.8秒 + 42.5秒 + 56秒 = 1分58.3秒。
  const elementResult: IceFloorMazeResult = {
    elapsedMs: 100_000,
    moveCount: 19,
    undoCount: 2,
    restartCount: 0,
    speedReference: { drawnCellCount: 99, elementCount: 7 },
    optimalMoveCount: 17,
    moveDelta: 2,
    speedRule: { fullScoreMs: 118_300, zeroScoreMs: 236_600 },
    timeDeltaMs: -18_300,
    score: { total: 96, breakdown: { efficiency: 56, speed: 40 } },
  };
  const staticResult: IceFloorMazeResult = {
    ...elementResult,
    speedReference: { drawnCellCount: 99, elementCount: 0 },
  };

  test("効率の基準に、ゆとりを足した比と半分の点になる総手数を示すこと", () => {
    const [efficiency] = getIceFloorMazeScoreCriteria(elementResult);

    expect(efficiency?.description).toBe(
      "最短17手で60点。総手数が増えるほど (最短手数 + 10) ÷ (総手数 + 10) の割合で減らし、44手で30点。総手数には「待った」で取り消した手と「盤面を戻す」前の手も含む。",
    );
  });

  test("要素のある問題では、基準時間の式にもろい岩・薄い氷の項を示すこと", () => {
    const [, speed] = getIceFloorMazeScoreCriteria(elementResult);

    expect(speed?.description).toContain(
      "基準時間は盤面99マス × 0.2秒 + 最短17手 × 2.5秒 + もろい岩・薄い氷7個 × 8秒。",
    );
  });

  test("要素の無い問題では、基準時間の式に要素の項を示さないこと", () => {
    const [, speed] = getIceFloorMazeScoreCriteria(staticResult);

    expect(speed?.description).toContain(
      "基準時間は盤面99マス × 0.2秒 + 最短17手 × 2.5秒。",
    );
  });
});

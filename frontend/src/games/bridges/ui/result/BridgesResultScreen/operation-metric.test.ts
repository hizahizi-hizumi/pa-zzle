import type { BridgesSolveWorkload } from "@/games/bridges/problem/workload";
import { createBridgesOperationMetric } from "@/games/bridges/ui/result/BridgesResultScreen/operation-metric";

const workload: BridgesSolveWorkload = {
  islandCount: 12,
  edgeCount: 18,
  bridgeCount: 20,
  countRoundCount: 3,
  connectivityRoundCount: 1,
  countReasoningUndecidedEdgeCount: 2,
};

describe("createBridgesOperationMetric", () => {
  test("架け直しの分を、解に要る橋の本数との差として示すこと", () => {
    const metric = createBridgesOperationMetric({ inputCount: 26, workload });

    expect(metric).toMatchObject({
      label: "橋の操作",
      value: "26回",
      comparison: { basis: "minimumMoves", difference: 6, display: "+6" },
    });
  });

  test("架け直しが無ければ、差を ±0 と示すこと", () => {
    const metric = createBridgesOperationMetric({ inputCount: 20, workload });

    expect(metric.comparison).toMatchObject({ difference: 0, display: "±0" });
  });
});

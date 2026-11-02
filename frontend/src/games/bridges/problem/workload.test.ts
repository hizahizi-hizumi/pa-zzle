import {
  listBridgesPoolEntries,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import {
  type BridgesSolveWorkload,
  isBridgesSolveWorkload,
  measureBridgesSolveWorkload,
} from "@/games/bridges/problem/workload";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";

describe("measureBridgesSolveWorkload", () => {
  describe("2本と1本の橋で3島をつなぐ盤面の場合", () => {
    const problem = parseBridgesBoard(["3.2", "...", "1.."]);
    const analysis = {
      countRoundCount: 1,
      connectivityRoundCount: 2,
      countReasoningUndecidedEdgeCount: 1,
      trialBacktrackCount: 4,
    };

    test("島・行き先・橋の本数を盤面から数え、読みの量を分析結果から写すこと", () => {
      const workload = measureBridgesSolveWorkload({
        problem,
        identity: toBridgesPooledProblem(listBridgesPoolEntries("1")[0]!)
          .identity,
        analysis,
      });

      expect(workload).toEqual({
        islandCount: 3,
        edgeCount: 2,
        bridgeCount: 3,
        countRoundCount: 1,
        connectivityRoundCount: 2,
        countReasoningUndecidedEdgeCount: 1,
      });
    });
  });

  test.each(["1", "2", "3", "4", "5"] as const)(
    "レベル %s の問題集の作業の量がどれも読み戻せる形であること",
    (difficulty) => {
      const workloads = listBridgesPoolEntries(difficulty).map((entry) =>
        measureBridgesSolveWorkload(toBridgesPooledProblem(entry)),
      );

      const invalid = workloads.filter(
        (workload) => !isBridgesSolveWorkload(workload),
      );

      expect(invalid).toEqual([]);
    },
  );
});

describe("isBridgesSolveWorkload", () => {
  const valid: BridgesSolveWorkload = {
    islandCount: 3,
    edgeCount: 2,
    bridgeCount: 3,
    countRoundCount: 0,
    connectivityRoundCount: 0,
    countReasoningUndecidedEdgeCount: 0,
  };

  const cases = [
    ["正しい作業の量", valid, true],
    ["島が無い", { ...valid, islandCount: 0 }, false],
    ["行き先が島の数 − 1 に足りない", { ...valid, edgeCount: 1 }, false],
    ["橋の本数が島の数 − 1 に足りない", { ...valid, bridgeCount: 1 }, false],
    [
      "決まらない行き先が行き先の数を超える",
      { ...valid, countReasoningUndecidedEdgeCount: 3 },
      false,
    ],
    ["整数でない値がある", { ...valid, countRoundCount: 0.5 }, false],
    ["オブジェクトでない", null, false],
  ] as const;

  test.each(cases)("%sなら %s を返すこと", (_, value, expected) => {
    const result = isBridgesSolveWorkload(value);

    expect(result).toBe(expected);
  });
});

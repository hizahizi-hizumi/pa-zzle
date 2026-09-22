import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "../../puzzle/rules";
import {
  createWaterSortStateKey,
  isWaterSortCleared,
  type WaterSortState,
} from "../../puzzle/state";
import { solveWaterSort } from "./solver";

function shortestDistanceByBreadthFirstSearch(
  initialState: WaterSortState,
): number | null {
  const queue: { state: WaterSortState; distance: number }[] = [
    { state: initialState, distance: 0 },
  ];
  const visited = new Set([createWaterSortStateKey(initialState)]);
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    if (!current) {
      continue;
    }
    if (isWaterSortCleared(current.state)) {
      return current.distance;
    }

    for (const move of listWaterSortLegalMoves(current.state)) {
      const nextState = applyWaterSortMove(current.state, move);
      if (!nextState) {
        continue;
      }
      const key = createWaterSortStateKey(nextState);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({ state: nextState, distance: current.distance + 1 });
    }
  }

  return null;
}

const solveAndApplyState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];
const comparisonState: WaterSortState = [
  [3, 3, 2, 1],
  [2, 1, 0, 3],
  [0, 1, 0, 2],
  [2, 1, 0, 3],
  [],
  [],
];
const reorderedComparisonState: WaterSortState = [
  [0, 1, 0, 2],
  [2, 1, 0, 3],
  [2, 1, 0, 3],
  [],
  [],
  [3, 3, 2, 1],
];
const invalidLimitOptions = { maxExpandedStates: 0.5 } as const;
const reachedLimitOptions = { maxExpandedStates: 0 } as const;

describe("solveWaterSort", () => {
  const shortestPathCases = [
    [[0, 1, 0, 1], [1, 0, 1, 0], [], []] satisfies WaterSortState,
    [[0, 0, 1, 1], [1, 1, 0, 0], [], []] satisfies WaterSortState,
    [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []] satisfies WaterSortState,
  ].map((state) => ({
    state,
    expectedMoveCount: shortestDistanceByBreadthFirstSearch(state),
  }));
  test.each(shortestPathCases)(
    "幅優先探索と同じ最短手数を返すこと: %#",
    ({ state, expectedMoveCount }) => {
      const result = solveWaterSort(state);

      expect(result.status).toBe("solved");
      expect(result.moves).toHaveLength(expectedMoveCount ?? 0);
    },
  );

  test("返した手順を入力盤面へ適用するとクリアできること", () => {
    const result = solveWaterSort(solveAndApplyState);

    const finalState = result.moves.reduce<WaterSortState>((state, move) => {
      const nextState = applyWaterSortMove(state, move);
      if (!nextState) {
        throw new Error("solver returned an illegal move");
      }
      return nextState;
    }, solveAndApplyState);
    const cleared = isWaterSortCleared(finalState);

    expect(result.status).toBe("solved");
    expect(cleared).toBe(true);
  });

  test("ボトルの表示順を変えても同じ問題特徴量を返すこと", () => {
    const result = solveWaterSort(comparisonState);
    const reorderedResult = solveWaterSort(reorderedComparisonState);

    expect(result.status).toBe("solved");
    expect(reorderedResult.status).toBe("solved");
    expect(reorderedResult.moves).toHaveLength(result.moves.length);
  });

  test("探索上限に整数以外を指定したら拒否すること", () => {
    const act = () => solveWaterSort(solveAndApplyState, invalidLimitOptions);

    expect(act).toThrow(
      "maxExpandedStates must be a non-negative integer or Infinity",
    );
  });

  test("探索上限へ到達したことを解なしと区別して返すこと", () => {
    const result = solveWaterSort(solveAndApplyState, reachedLimitOptions);

    expect(result.status).toBe("limit-reached");
  });
});

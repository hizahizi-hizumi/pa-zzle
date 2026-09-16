import { describe, expect, test } from "vitest";

import { applyWaterSortMove, listWaterSortLegalMoves } from "./rules";
import { solveWaterSort } from "./solver";
import {
  createWaterSortStateKey,
  isWaterSortCleared,
  type WaterSortState,
} from "./state";

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

const shortestPathSamples = [
  {
    state: [[0, 1, 0, 1], [1, 0, 1, 0], [], []] satisfies WaterSortState,
  },
  {
    state: [[0, 0, 1, 1], [1, 1, 0, 0], [], []] satisfies WaterSortState,
  },
  {
    state: [
      [0, 1, 2, 0],
      [1, 2, 0, 1],
      [2, 0, 1, 2],
      [],
      [],
    ] satisfies WaterSortState,
  },
] as const;

describe("solveWaterSort", () => {
  test.each(shortestPathSamples)(
    "幅優先探索と同じ最短手数を返すこと: %#",
    ({ state }) => {
      const expected = shortestDistanceByBreadthFirstSearch(state);

      const result = solveWaterSort(state);

      expect(result.status).toBe("solved");
      expect(result.features?.shortestMoveCount).toBe(expected);
      expect(result.moves).toHaveLength(expected ?? 0);
    },
  );

  test("返した手順を入力盤面へ適用するとクリアできること", () => {
    const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];
    const result = solveWaterSort(initialState);

    const finalState = result.moves.reduce<WaterSortState>((state, move) => {
      const nextState = applyWaterSortMove(state, move);
      if (!nextState) {
        throw new Error("solver returned an illegal move");
      }
      return nextState;
    }, initialState);

    expect(result.status).toBe("solved");
    expect(isWaterSortCleared(finalState)).toBe(true);
  });

  test("ボトルの表示順を変えても同じ問題特徴量を返すこと", () => {
    const state: WaterSortState = [
      [3, 3, 2, 1],
      [2, 1, 0, 3],
      [0, 1, 0, 2],
      [2, 1, 0, 3],
      [],
      [],
    ];
    const reorderedState: WaterSortState = [
      [0, 1, 0, 2],
      [2, 1, 0, 3],
      [2, 1, 0, 3],
      [],
      [],
      [3, 3, 2, 1],
    ];

    const result = solveWaterSort(state);
    const reorderedResult = solveWaterSort(reorderedState);

    expect(result.status).toBe("solved");
    expect(reorderedResult.status).toBe("solved");
    expect(reorderedResult.features).toEqual(result.features);
  });

  test("探索上限に整数以外を指定したら拒否すること", () => {
    const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];
    const act = () => solveWaterSort(initialState, { maxExpandedStates: 0.5 });

    expect(act).toThrow(
      "maxExpandedStates must be a non-negative integer or Infinity",
    );
  });

  test("探索上限へ到達したことを解なしと区別して返すこと", () => {
    const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

    const result = solveWaterSort(initialState, { maxExpandedStates: 0 });

    expect(result.status).toBe("limit-reached");
    expect(result.features).toBeNull();
  });

  test("最短経路上の分岐と空ボトル圧力を特徴量として返すこと", () => {
    const initialState: WaterSortState = [[0, 0, 1, 1], [1, 1, 0, 0], [], []];

    const result = solveWaterSort(initialState);

    expect(result.features).not.toBeNull();
    expect(result.features?.initialLegalMoveCount).toBeGreaterThan(0);
    expect(result.features?.initialDistinctChoiceCount).toBeGreaterThan(0);
    expect(
      result.features?.averageDistinctChoiceCountOnSolution,
    ).toBeGreaterThan(0);
    expect(result.features?.forcedChoiceRatio).toBeGreaterThanOrEqual(0);
    expect(result.features?.forcedChoiceRatio).toBeLessThanOrEqual(1);
    expect(result.features?.noEmptyBottleStateRatio).toBeGreaterThanOrEqual(0);
    expect(result.features?.noEmptyBottleStateRatio).toBeLessThanOrEqual(1);
  });
});

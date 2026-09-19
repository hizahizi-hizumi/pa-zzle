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
    expect(reorderedResult.moves).toHaveLength(result.moves.length);
  });

  test("探索上限に整数以外を指定したら拒否すること", () => {
    const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];
    function act() {
      return solveWaterSort(initialState, { maxExpandedStates: 0.5 });
    }

    expect(act).toThrow(
      "maxExpandedStates must be a non-negative integer or Infinity",
    );
  });

  test("探索上限へ到達したことを解なしと区別して返すこと", () => {
    const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

    const result = solveWaterSort(initialState, { maxExpandedStates: 0 });

    expect(result.status).toBe("limit-reached");
  });
});

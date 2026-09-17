import { describe, expect, test } from "vitest";

import type { WaterSortState } from "./state";
import { listWaterSortDistinctTransitions } from "./transitions";

describe("listWaterSortDistinctTransitions", () => {
  test("空ボトルの表示位置だけが異なる同値な次状態を一つにまとめること", () => {
    const state: WaterSortState = [[0, 1], [1], [], []];

    const result = listWaterSortDistinctTransitions(state);
    const emptyDestinationTransitions = result.filter(
      ({ move }) =>
        move.sourceBottleIndex === 0 &&
        (move.destinationBottleIndex === 2 ||
          move.destinationBottleIndex === 3),
    );

    expect(emptyDestinationTransitions).toHaveLength(1);
  });
});

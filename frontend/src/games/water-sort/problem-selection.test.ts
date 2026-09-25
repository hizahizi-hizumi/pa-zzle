import {
  assessWaterSortDifficulty,
  waterSortDifficulties,
} from "@/games/water-sort/difficulty";
import {
  listWaterSortPoolEntries,
  toWaterSortPooledProblem,
} from "@/games/water-sort/problem/problem-pool";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import { isStandardWaterSortInitialState } from "@/games/water-sort/puzzle/state";

const difficulties = waterSortDifficulties.map(({ id }) => id);

describe("問題集", () => {
  test.each(difficulties)(
    "難易度 %s の全問題が判定条件を満たすこと",
    (difficulty) => {
      const entries = listWaterSortPoolEntries(difficulty);

      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const { identity, stuckRate } = toWaterSortPooledProblem(entry);
        expect(
          assessWaterSortDifficulty({
            conditions: identity.conditions,
            stuckRate,
          }),
        ).toBe(difficulty);
      }
    },
  );
});

describe("selectWaterSortProblemForDifficulty", () => {
  test.each(difficulties)(
    "難易度 %s の問題集から同じseedで同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectWaterSortProblemForDifficulty(difficulty, "seed-a");
      const second = selectWaterSortProblemForDifficulty(difficulty, "seed-a");

      expect(second).toEqual(first);
      expect(
        isStandardWaterSortInitialState(
          first.problem.initialState,
          first.identity.conditions.colorCount,
          first.identity.conditions.emptyBottleCount,
        ),
      ).toBe(true);
    },
  );
});

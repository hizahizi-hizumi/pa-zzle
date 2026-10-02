import { createProblemId } from "@/games/problem-id";
import {
  assessWaterSortDifficulty,
  waterSortDifficulties,
} from "@/games/water-sort/difficulty";
import {
  listWaterSortPoolEntries,
  toWaterSortPooledProblem,
} from "@/games/water-sort/problem/problem-pool";
import {
  selectWaterSortProblemById,
  selectWaterSortProblemForDifficulty,
} from "@/games/water-sort/problem-selection";
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

describe("selectWaterSortProblemById", () => {
  const selected = selectWaterSortProblemForDifficulty("1", "seed-a");
  const problemId = createProblemId(selected.identity);

  test("seed で選んだ問題を、その問題IDから同じ問題として引けること", () => {
    const found = selectWaterSortProblemById("1", problemId);

    expect(found).toEqual(selected);
  });

  test("別の難易度の問題IDには null を返すこと", () => {
    const found = selectWaterSortProblemById("2", problemId);

    expect(found).toBeNull();
  });
});

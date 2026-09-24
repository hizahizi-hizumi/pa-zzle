import { createProblemSeededRandom } from "@/games/problem-seed";
import { analyzeWaterSortNaturalPlay } from "@/games/water-sort/problem/natural-play";

describe("analyzeWaterSortNaturalPlay", () => {
  test.each([
    ["完成済みの盤面", [[0, 0, 0, 0], [1, 1, 1, 1], []], 0],
    [
      "合法手が無い未完成の盤面",
      [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
      ],
      1,
    ],
  ] as const)("%s では行き詰まる割合 %d を返すこと", (_, state, expected) => {
    const analysis = analyzeWaterSortNaturalPlay(state, {
      trialCount: 5,
      random: createProblemSeededRandom("natural-play-test"),
    });

    expect(analysis.stuckRate).toBe(expected);
  });

  test("同じ乱数系列から同じ結果を再現すること", () => {
    const state = [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], []] as const;

    const first = analyzeWaterSortNaturalPlay(state, {
      random: createProblemSeededRandom("natural-play-reproducible"),
    });
    const second = analyzeWaterSortNaturalPlay(state, {
      random: createProblemSeededRandom("natural-play-reproducible"),
    });

    expect(second).toEqual(first);
  });
});

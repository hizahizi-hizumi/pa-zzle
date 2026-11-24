import { tryFukumenzanNaively } from "@/games/fukumenzan/problem/generation/naive-trial";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

const problem = parseFukumenzanEquation("BYK+KTK=TKHH")!;

describe("tryFukumenzanNaively", () => {
  describe("置く数の上限が十分な場合", () => {
    test("解き切り、同じ乱数なら同じ数だけ置くこと", () => {
      const trials = [0, 1].map(() =>
        tryFukumenzanNaively(
          problem,
          createProblemSeededRandom("naive-trial"),
          100_000,
        ),
      );

      expect(trials[0]!.solved).toBe(true);
      expect(trials[1]).toEqual(trials[0]);
    });
  });

  describe("置く数の上限が文字の数より少ない場合", () => {
    test("上限を超えたところで止め、解けなかったと返すこと", () => {
      const trial = tryFukumenzanNaively(
        problem,
        createProblemSeededRandom("naive-trial"),
        3,
      );

      expect({
        solved: trial.solved,
        placementCount: trial.placementCount,
      }).toEqual({
        solved: false,
        placementCount: 4,
      });
    });
  });
});

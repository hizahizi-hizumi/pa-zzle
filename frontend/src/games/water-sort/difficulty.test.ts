import {
  assessWaterSortDifficulty,
  parseWaterSortDifficulty,
} from "@/games/water-sort/difficulty";

describe("parseWaterSortDifficulty", () => {
  test.each(["1", "2", "3", "4", "5"] as const)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each([undefined, "", "easy", "normal", "hard", "6"])(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("assessWaterSortDifficulty", () => {
  const cases = [
    [{ colorCount: 4, emptyBottleCount: 2 }, 0, "1"],
    [{ colorCount: 6, emptyBottleCount: 2 }, 0.05, "1"],
    [{ colorCount: 6, emptyBottleCount: 2 }, 0.2, "2"],
    [{ colorCount: 8, emptyBottleCount: 2 }, 0.35, "2"],
    [{ colorCount: 8, emptyBottleCount: 2 }, 0.5, "3"],
    [{ colorCount: 4, emptyBottleCount: 1 }, 0.6, "3"],
    [{ colorCount: 10, emptyBottleCount: 2 }, 0.8, "4"],
    [{ colorCount: 6, emptyBottleCount: 1 }, 0.9, "4"],
    [{ colorCount: 12, emptyBottleCount: 2 }, 1, "5"],
    [{ colorCount: 7, emptyBottleCount: 1 }, 0.95, "5"],
  ] as const;

  test.each(cases)(
    "%o で自然詰み率 %d の問題を難易度 %s と判定すること",
    (conditions, stuckRate, expected) => {
      const difficulty = assessWaterSortDifficulty({ conditions, stuckRate });

      expect(difficulty).toBe(expected);
    },
  );

  test.each([
    [{ colorCount: 4, emptyBottleCount: 2 }, 0.5],
    [{ colorCount: 12, emptyBottleCount: 2 }, 0.8],
    [{ colorCount: 8, emptyBottleCount: 1 }, 1],
  ] as const)(
    "%o で自然詰み率 %d の問題はどの難易度の候補領域にも含めないこと",
    (conditions, stuckRate) => {
      const difficulty = assessWaterSortDifficulty({ conditions, stuckRate });

      expect(difficulty).toBeNull();
    },
  );
});

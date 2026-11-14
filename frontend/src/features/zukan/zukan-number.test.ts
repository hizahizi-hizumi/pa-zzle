import { createZukanNumberFinder } from "@/features/zukan/zukan-number";
import type { DifficultyLevel } from "@/games/difficulty";

describe("createZukanNumberFinder", () => {
  const poolProblemIds: Record<DifficultyLevel, readonly string[]> = {
    "1": ["a", "b"],
    "2": ["c"],
    "3": [],
    "4": ["d", "e"],
    "5": ["f"],
  };
  const listPoolProblemIds = vi.fn(
    (difficulty: DifficultyLevel) => poolProblemIds[difficulty],
  );
  const findZukanNumber = createZukanNumberFinder(listPoolProblemIds);
  const cases = [
    ["1", "a", { number: 1, problemCount: 6 }],
    ["2", "c", { number: 3, problemCount: 6 }],
    ["4", "e", { number: 5, problemCount: 6 }],
    ["2", "a", null],
    ["5", "unknown", null],
  ] as const;

  test.each(cases)(
    "問題集の並び順でゲームの中を通して付けた番号と全問の数を、難易度と問題 ID で引くこと: %s %s",
    (difficulty, problemId, expected) => {
      const found = findZukanNumber(difficulty, problemId);

      expect(found).toEqual(expected);
    },
  );

  describe("一度引いたあとの場合", () => {
    let findAgain: ReturnType<typeof createZukanNumberFinder>;

    beforeEach(() => {
      listPoolProblemIds.mockClear();
      findAgain = createZukanNumberFinder(listPoolProblemIds);
      findAgain("1", "a");
    });

    test("番号の表を作り直さないこと", () => {
      findAgain("4", "d");

      expect(listPoolProblemIds).toHaveBeenCalledTimes(5);
    });
  });
});

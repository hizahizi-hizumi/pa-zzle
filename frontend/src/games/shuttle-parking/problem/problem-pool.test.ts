import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import {
  createShuttleParkingProblemSeed,
  restoreShuttleParkingProblem,
} from "@/games/shuttle-parking/problem/problem";
import {
  decodeShuttleParkingPoolEntry,
  findShuttleParkingPoolEntryByProblemId,
  listShuttleParkingPoolEntries,
  listShuttleParkingPoolProblemIds,
} from "@/games/shuttle-parking/problem/problem-pool";
import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import { createShuttleParkingInitialState } from "@/games/shuttle-parking/puzzle/rules";

describe.each(difficultyLevels.map(({ id }) => id))(
  "レベル %s の問題集の場合",
  (difficulty) => {
    const entries = listShuttleParkingPoolEntries(difficulty);

    test("問題があること", () => {
      expect(entries.length).toBeGreaterThan(0);
    });

    test.each(entries)("%s は復元でき、全員を送り出せること", (entry) => {
      const { problem } = restoreShuttleParkingProblem(
        decodeShuttleParkingPoolEntry(entry),
      );

      const clearable = createShuttleParkingClearability(problem).canClear(
        createShuttleParkingInitialState(problem),
      );

      expect(createShuttleParkingProblemSeed(problem)).toBe(entry);
      expect(clearable).toBe(true);
    });

    test("並び順の問題IDでその問題を引けること", () => {
      const problemIds = listShuttleParkingPoolProblemIds(difficulty);

      const found = problemIds.map((problemId) =>
        findShuttleParkingPoolEntryByProblemId(difficulty, problemId),
      );

      expect(found).toEqual(entries);
      expect(problemIds).toEqual(
        entries.map((entry) =>
          createProblemId(decodeShuttleParkingPoolEntry(entry)),
        ),
      );
    });
  },
);

describe("findShuttleParkingPoolEntryByProblemId", () => {
  const [problemId] = listShuttleParkingPoolProblemIds("1");

  test("別のレベルの問題IDには null を返すこと", () => {
    const found = findShuttleParkingPoolEntryByProblemId("2", problemId!);

    expect(found).toBeNull();
  });
});

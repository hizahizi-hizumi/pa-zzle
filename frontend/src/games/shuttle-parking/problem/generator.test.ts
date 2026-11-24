import { findShuttleParkingMinimumBays } from "@/games/shuttle-parking/problem/generation/state-game";
import {
  generateShuttleParkingCandidate,
  SHUTTLE_PARKING_CAR_COUNT,
  SHUTTLE_PARKING_OPENINGS,
} from "@/games/shuttle-parking/problem/generator";
import { assertShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";

const conditions = [
  { size: 6, opening: "adjacent2" },
  { size: 6, opening: "one" },
  { size: 7, opening: "adjacent2" },
  { size: 7, opening: "one" },
] as const;

describe("generateShuttleParkingCandidate", () => {
  describe.each(conditions)(
    "$size×$size・出口 $opening の場合",
    (condition) => {
      const candidates = Array.from({ length: 20 }, (_, index) =>
        generateShuttleParkingCandidate(condition, `generator-test:${index}`),
      ).filter((problem) => problem !== null);

      test("同じ seed から同じ問題を作ること", () => {
        const first = generateShuttleParkingCandidate(condition, "same-seed");

        const second = generateShuttleParkingCandidate(condition, "same-seed");

        expect(second).toEqual(first);
      });

      test("生成条件どおりの、問題契約を満たす問題を作ること", () => {
        expect(candidates.length).toBeGreaterThan(10);
        for (const problem of candidates) {
          expect(() => assertShuttleParkingProblem(problem)).not.toThrow();
          expect(problem.lot.size).toBe(condition.size);
          expect(problem.lot.openSides).toEqual(
            SHUTTLE_PARKING_OPENINGS[condition.opening],
          );
          expect(problem.lot.cars).toHaveLength(SHUTTLE_PARKING_CAR_COUNT);
        }
      });

      test("待機枠を解ける最小の数（2〜4）にすること", () => {
        const bays = candidates.map((problem) => [
          problem.bayCount,
          findShuttleParkingMinimumBays(problem),
        ]);

        for (const [bayCount, minimum] of bays) {
          expect(bayCount).toBe(minimum);
          expect(bayCount).toBeGreaterThanOrEqual(2);
          expect(bayCount).toBeLessThanOrEqual(4);
        }
      });
    },
  );
});

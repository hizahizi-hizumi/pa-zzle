import { describe, expect, test } from "vitest";
import { curatedStudyGames } from "@/experiments/curated-study";
import {
  selectCuratedStudySequence,
  simulateCuratedStudySupply,
} from "@/experiments/curated-study-selection";

const games = ["nanpure", "parking-jam"] as const;

describe("selectCuratedStudySequence", () => {
  test.each(games)(
    "%s の固定した軽量選抜と再計算結果が一致すること",
    (gameId) => {
      const candidates = selectCuratedStudySequence(gameId, 0, "diverse");

      expect(candidates).toEqual(curatedStudyGames[gameId].sets.c);
    },
  );

  test.each(games)(
    "%s の無作為選抜が固定した乱数系列で再現できること",
    (gameId) => {
      const first = selectCuratedStudySequence(gameId, 3, "random");
      const second = selectCuratedStudySequence(gameId, 3, "random");

      expect(first).toEqual(second);
      expect(first).toHaveLength(6);
    },
  );

  test.each(games)("%s の利用済み問題を次の選抜から除外すること", (gameId) => {
    const first = selectCuratedStudySequence(gameId, 0, "diverse") ?? [];
    const next = selectCuratedStudySequence(
      gameId,
      1,
      "diverse",
      new Set(first.map((c) => c.problemId)),
    );

    expect(next).toHaveLength(6);
    expect(
      next?.every(
        (c) => !first.some((prior) => prior.problemId === c.problemId),
      ),
    ).toBe(true);
  });
});

describe("simulateCuratedStudySupply", () => {
  test.each([
    ["nanpure", 20, 120],
    ["parking-jam", 17, 102],
  ] as const)(
    "%s は同じ厳格な規模条件で問題の供給上限を検出すること",
    (gameId, episodes, problems) => {
      const random = simulateCuratedStudySupply(gameId, "random", 120);
      const diverse = simulateCuratedStudySupply(gameId, "diverse", 120);

      expect(random).toMatchObject({
        completedEpisodes: episodes,
        uniqueProblems: problems,
        exhausted: true,
      });
      expect(diverse).toMatchObject({
        completedEpisodes: episodes,
        uniqueProblems: problems,
        exhausted: true,
      });
      expect(diverse.averagePairDistance).toBeGreaterThan(
        random.averagePairDistance,
      );
    },
  );
});

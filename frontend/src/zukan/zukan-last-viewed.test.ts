import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import type {
  GameZukan,
  ZukanDifficultySection,
  ZukanProblem,
} from "@/zukan/zukan-collection";
import {
  findZukanChanges,
  listUnchangedZukanDifficulties,
  listZukanViewedStatuses,
  noZukanChanges,
  type ZukanViewedStatuses,
} from "@/zukan/zukan-last-viewed";

function solved(
  difficulty: DifficultyLevel,
  problemId: string,
  bestScore: number,
): ZukanProblem {
  return {
    kind: "solved",
    number: 1,
    difficulty,
    problemId,
    bestScore,
    fastestElapsedMs: 60_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstClearedAt: 0,
  };
}

function unsolved(
  difficulty: DifficultyLevel,
  problemId: string,
  attempted = false,
): ZukanProblem {
  return { kind: "unsolved", number: 1, difficulty, problemId, attempted };
}

function createZukan(
  problemsByDifficulty: Partial<Record<DifficultyLevel, ZukanProblem[]>>,
): GameZukan {
  const sections = difficultyLevels.map(({ id }): ZukanDifficultySection => {
    const problems = problemsByDifficulty[id] ?? [];
    return {
      difficulty: id,
      problems,
      solvedCount: problems.filter(({ kind }) => kind === "solved").length,
    };
  });
  return {
    sections,
    problemCount: 0,
    solvedCount: 0,
    latestPlayedDifficulty: null,
  };
}

const zukan = createZukan({
  "1": [solved("1", "a", 100), solved("1", "b", 85), unsolved("1", "c", true)],
  "3": [solved("3", "d", 70), unsolved("3", "e")],
});

const allDifficulties = difficultyLevels.map(({ id }) => id);

describe("listZukanViewedStatuses", () => {
  test("解いた問題の評価段階と挑戦中の問題を、未挑戦の問題を除いて難易度ごとに問題 ID で引けるようにすること", () => {
    const statuses = listZukanViewedStatuses(zukan, allDifficulties);

    expect(statuses).toEqual({
      "1": { a: "perfect", b: "good", c: "attempted" },
      "2": {},
      "3": { d: "clear" },
      "4": {},
      "5": {},
    });
  });

  test("指定した難易度だけを含めること", () => {
    const statuses = listZukanViewedStatuses(zukan, ["3"]);

    expect(statuses).toEqual({ "3": { d: "clear" } });
  });
});

describe("findZukanChanges", () => {
  describe("前回の状態が無い場合", () => {
    test("変化なしとすること", () => {
      const changes = findZukanChanges(zukan, null);

      expect(changes).toBe(noZukanChanges);
    });
  });

  describe("前回から変わっていない場合", () => {
    const lastViewed = listZukanViewedStatuses(zukan, allDifficulties);

    test("変化なしとすること", () => {
      const changes = findZukanChanges(zukan, lastViewed);

      expect(changes).toEqual(noZukanChanges);
    });
  });

  describe("前回から新しく解いた問題と段階が上がった問題がある場合", () => {
    const lastViewed: ZukanViewedStatuses = {
      "1": { a: "attempted", b: "clear" },
      "3": {},
    };

    test("新しく解いた問題と段階が上がった問題を、変化する前の状態とともに難易度ごとに返すこと", () => {
      const { byDifficulty } = findZukanChanges(zukan, lastViewed);

      expect(byDifficulty).toEqual({
        "1": new Map([
          ["a", { kind: "newly-solved", previousStatus: "attempted" }],
          ["b", { kind: "raised", previousStatus: "clear" }],
        ]),
        "3": new Map([
          ["d", { kind: "newly-solved", previousStatus: "untouched" }],
        ]),
      });
    });

    test("新しく解いた問題と段階が上がった問題をそれぞれ数えること", () => {
      const { newlySolvedCount, raisedCount } = findZukanChanges(
        zukan,
        lastViewed,
      );

      expect({ newlySolvedCount, raisedCount }).toEqual({
        newlySolvedCount: 2,
        raisedCount: 1,
      });
    });
  });

  describe("前回より段階が下がった問題がある場合", () => {
    const lastViewed: ZukanViewedStatuses = {
      "1": { a: "perfect", b: "great" },
      "3": { d: "clear" },
    };

    test("変化に数えないこと", () => {
      const changes = findZukanChanges(zukan, lastViewed);

      expect(changes).toEqual(noZukanChanges);
    });
  });
});

describe("listUnchangedZukanDifficulties", () => {
  const lastViewed: ZukanViewedStatuses = {
    "1": { a: "perfect", b: "good" },
    "3": {},
  };
  const changes = findZukanChanges(zukan, lastViewed);

  test("変化の無い難易度だけを返すこと", () => {
    const difficulties = listUnchangedZukanDifficulties(zukan, changes);

    expect(difficulties).toEqual(["1", "2", "4", "5"]);
  });
});

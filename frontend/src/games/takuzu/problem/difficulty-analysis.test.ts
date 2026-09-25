import {
  _private,
  analyzeTakuzuDifficulty,
} from "@/games/takuzu/problem/difficulty-analysis";
import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import type { TakuzuHumanSolveRound } from "@/games/takuzu/problem/generation/human-solver";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

const { findLongestStreak } = _private;

function createProblemFromGivensOnly(rows: readonly string[]): TakuzuProblem {
  return {
    givens: parseTakuzuBoard(rows),
    solution: parseTakuzuBoard(rows),
  };
}

describe("analyzeTakuzuDifficulty", () => {
  describe("手筋で解き切れる一意解の問題", () => {
    test("規模と手筋の特徴を返すこと", () => {
      const result = analyzeTakuzuDifficulty(takuzuFixedProblem);

      expect(result.status).toBe("analyzed");
      expect(result.scale).toEqual({
        cellCount: 64,
        givenCount: 20,
        emptyCellCount: 44,
      });
    });

    test("ラウンド数を手筋ごとの回数の合計と一致させること", () => {
      const result = analyzeTakuzuDifficulty(takuzuFixedProblem);

      const features = result.status === "analyzed" ? result.features : null;
      const totalByTechnique = Object.values(
        features?.roundCountByTechnique ?? {},
      ).reduce((sum, count) => sum + count, 0);
      expect(totalByTechnique).toBe(features?.roundCount);
    });
  });

  describe("一意解だが1本の行・列を読む手筋では解き切れない問題", () => {
    const problem: TakuzuProblem = {
      givens: parseTakuzuBoard([
        "AA...A..",
        "...B..B.",
        "....A..A",
        "....A...",
        "........",
        "..B..A.B",
        "....A...",
        "........",
      ]),
      solution: parseTakuzuBoard([
        "AABABABB",
        "ABABBABA",
        "BABBABAA",
        "ABBAABAB",
        "BBAABABA",
        "AABBAABB",
        "BAABABAB",
        "BBAABBAA",
      ]),
    };

    test("評価不能として返すこと", () => {
      const result = analyzeTakuzuDifficulty(problem);

      expect(result.status).toBe("unsupported");
    });
  });

  describe("成立しない初期配置", () => {
    const cases = [
      [
        "解が2つ以上ある初期配置",
        createProblemFromGivensOnly(Array(8).fill("........")),
        "multiple-solutions",
      ],
      [
        "解が無い初期配置",
        createProblemFromGivensOnly(["AAA.....", ...Array(7).fill("........")]),
        "no-solution",
      ],
    ] as const;

    test.each(cases)("%s を理由付きで返すこと", (_, problem, reason) => {
      const result = analyzeTakuzuDifficulty(problem);

      expect(result).toMatchObject({ status: "invalid", reason });
    });
  });
});

describe("findLongestStreak", () => {
  const rounds = (
    [
      "adjacency",
      "single-remaining",
      "duplicate-avoidance",
      "adjacency",
      "single-remaining",
    ] as const
  ).map(
    (technique): TakuzuHumanSolveRound => ({
      technique,
      deductions: [],
      sourceCount: 1,
      emptyCellCount: 10,
      sourceLineEmptyCellCount: null,
      requiresDuplicateAvoidance: false,
    }),
  );

  test("条件に合うラウンドが続いた最長の回数を返すこと", () => {
    const result = findLongestStreak(
      rounds,
      (round) => round.technique !== "adjacency",
    );

    expect(result).toBe(2);
  });
});

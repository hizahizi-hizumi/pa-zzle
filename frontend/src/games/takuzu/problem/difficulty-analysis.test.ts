import {
  _private,
  analyzeTakuzuDifficulty,
  type TakuzuHumanSolveFeatures,
} from "@/games/takuzu/problem/difficulty-analysis";
import type { TakuzuHumanSolveRound } from "@/games/takuzu/problem/generation/human-solver";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

const { findLongestStreak } = _private;

/** 分析は初期配置だけを使うので、解には初期配置をそのまま入れる。 */
function createProblemFromGivensOnly(rows: readonly string[]): TakuzuProblem {
  return {
    givens: parseTakuzuBoard(rows),
    solution: parseTakuzuBoard(rows),
  };
}

function rotateRows(rows: readonly string[]): string[] {
  return rows.map((_, row) =>
    rows
      .map((line) => line[row])
      .reverse()
      .join(""),
  );
}

function mirrorRows(rows: readonly string[]): string[] {
  return rows.map((line) => [...line].reverse().join(""));
}

function swapTiles(rows: readonly string[]): string[] {
  return rows.map((line) =>
    line.replace(/[AB]/g, (tile) => (tile === "A" ? "B" : "A")),
  );
}

describe("analyzeTakuzuDifficulty", () => {
  describe("手筋で解き切れる一意解の問題", () => {
    // 難易度文書 §9 の問題の初期配置。
    const cases: readonly [
      string,
      readonly string[],
      Partial<TakuzuHumanSolveFeatures>,
    ][] = [
      [
        "重複の回避が1つの局面で要る問題（tk-duplicate-avoidance-2-160）",
        [
          "..A.....",
          "...AB..B",
          ".BB...B.",
          "....A...",
          "AA....A.",
          "....BB..",
          "BB......",
          ".A.A..A.",
        ],
        {
          deepestTechnique: "duplicate-avoidance",
          roundCountByTechnique: {
            adjacency: 11,
            "count-completion": 6,
            "single-remaining": 1,
            "duplicate-avoidance": 1,
            "general-line": 0,
          },
          roundCount: 19,
          lineReadingRoundCount: 2,
          duplicateAvoidanceRoundCount: 1,
          longestLineReadingStreak: 1,
          meanSourceCount: 45 / 19,
          minimumSourceCount: 1,
          singleSourceRoundCount: 7,
          firstLineReadingEmptyCellRatio: 16 / 64,
        },
      ],
      [
        "行・列を読む手筋が3ラウンド続く問題（tk-general-line-14-190）",
        [
          ".ABA....",
          "AA.ABB..",
          ".BAB..A.",
          "B...AA..",
          "..AABB.B",
          "BA...AB.",
          ".B.....B",
          "BB.B.AB.",
        ],
        {
          deepestTechnique: "duplicate-avoidance",
          roundCountByTechnique: {
            adjacency: 3,
            "count-completion": 1,
            "single-remaining": 1,
            "duplicate-avoidance": 2,
            "general-line": 0,
          },
          roundCount: 7,
          lineReadingRoundCount: 3,
          duplicateAvoidanceRoundCount: 2,
          longestLineReadingStreak: 3,
          meanSourceCount: 31 / 7,
          minimumSourceCount: 1,
          singleSourceRoundCount: 1,
          firstLineReadingEmptyCellRatio: 14 / 64,
        },
      ],
      [
        "一般の行候補でも重複の除外が要る問題（tk-general-line-0-1）",
        [
          ".....AB.",
          ".A.B..A.",
          "A.......",
          "A....A.A",
          ".B.A....",
          "B.......",
          "........",
          ".A.....A",
        ],
        {
          deepestTechnique: "general-line",
          roundCountByTechnique: {
            adjacency: 17,
            "count-completion": 5,
            "single-remaining": 4,
            "duplicate-avoidance": 1,
            "general-line": 1,
          },
          roundCount: 28,
          lineReadingRoundCount: 6,
          duplicateAvoidanceRoundCount: 2,
          longestLineReadingStreak: 2,
          meanSourceCount: 47 / 28,
          minimumSourceCount: 1,
          singleSourceRoundCount: 15,
          firstLineReadingEmptyCellRatio: 44 / 64,
        },
      ],
    ];

    test.each(cases)("%s の特徴量を返すこと", (_, rows, features) => {
      const result = analyzeTakuzuDifficulty(createProblemFromGivensOnly(rows));

      expect(result).toMatchObject({ status: "analyzed", features });
    });
  });

  describe("初期配置の規模", () => {
    const problem = createProblemFromGivensOnly([
      "..A.....",
      "...AB..B",
      ".BB...B.",
      "....A...",
      "AA....A.",
      "....BB..",
      "BB......",
      ".A.A..A.",
    ]);

    test("マス・初期配置・空きマスの数を返すこと", () => {
      const result = analyzeTakuzuDifficulty(problem);

      expect(result.scale).toEqual({
        cellCount: 64,
        givenCount: 18,
        emptyCellCount: 46,
      });
    });
  });

  describe("盤面を回転・反転し、A と B を入れ替えた問題", () => {
    const rows = [
      ".....AB.",
      ".A.B..A.",
      "A.......",
      "A....A.A",
      ".B.A....",
      "B.......",
      "........",
      ".A.....A",
    ];
    const original = analyzeTakuzuDifficulty(createProblemFromGivensOnly(rows));
    const cases = [
      ["90° 回転", rotateRows(rows)],
      ["左右反転", mirrorRows(rows)],
      ["A と B の入れ替え", swapTiles(rows)],
      ["回転・反転・入れ替えの組合せ", swapTiles(mirrorRows(rotateRows(rows)))],
    ] as const;

    test.each(cases)(
      "%s でも元の問題と同じ分析結果を返すこと",
      (_, transformed) => {
        const result = analyzeTakuzuDifficulty(
          createProblemFromGivensOnly(transformed),
        );

        expect(result).toEqual(original);
      },
    );
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

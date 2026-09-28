import {
  _private,
  analyzeNanpureDifficulty,
  type NanpureDifficultyAnalysis,
} from "@/games/nanpure/problem/difficulty-analysis";
import type { NanpureHumanSolveRound } from "@/games/nanpure/problem/generation/human-solver";
import type { NanpureBoard, NanpureCell } from "@/games/nanpure/puzzle/board";

const { findLongestStreak } = _private;

function boardFromString(value: string): NanpureBoard {
  return [...value].map<NanpureCell>((cell) =>
    cell === "." ? null : (Number(cell) as NanpureCell),
  );
}

const noOtherRounds = {
  "naked-pair": 0,
  "hidden-pair": 0,
  "naked-triple": 0,
  "hidden-triple": 0,
  "x-wing": 0,
  swordfish: 0,
  "xy-wing": 0,
  "xyz-wing": 0,
} as const;

describe("analyzeNanpureDifficulty", () => {
  // 難易度の検討記録 §9 の代表問題。
  const cases: readonly [string, NanpureBoard, NanpureDifficultyAnalysis][] = [
    [
      "ブロックのシングルだけで解ける問題（np-uniqueness-412）",
      boardFromString(
        "7....86.1..........12.93......5..738......1...36.........85...497.26.5......47...",
      ),
      {
        status: "analyzed",
        scale: { clueCount: 25, emptyCellCount: 56 },
        features: {
          deepestTechnique: "hidden-single-block",
          roundCountByTechnique: {
            "full-house": 10,
            "hidden-single-block": 14,
            "hidden-single-line": 0,
            "naked-single": 0,
            "locked-candidates": 0,
            ...noOtherRounds,
          },
          roundCount: 24,
          deepestTechniqueRoundCount: 14,
          eliminationRoundCount: 0,
          longestEliminationStreak: 0,
          meanAvailablePlacementCount: 7.75,
          minimumAvailablePlacementCount: 2,
          singleAvailablePlacementRoundCount: 0,
          firstEliminationEmptyCellRatio: null,
        },
      },
    ],
    [
      "ブロックと行・列の重なりが8局面で要る問題（np-uniqueness-120）",
      boardFromString(
        "....5...2..87..6...5..4.7...4..6.....158.4.....251.......49...6.7......86......45",
      ),
      {
        status: "analyzed",
        scale: { clueCount: 25, emptyCellCount: 56 },
        features: {
          deepestTechnique: "locked-candidates",
          roundCountByTechnique: {
            "full-house": 8,
            "hidden-single-block": 17,
            "hidden-single-line": 3,
            "naked-single": 2,
            "locked-candidates": 8,
            ...noOtherRounds,
          },
          roundCount: 38,
          deepestTechniqueRoundCount: 8,
          eliminationRoundCount: 8,
          longestEliminationStreak: 6,
          meanAvailablePlacementCount: 4.4,
          minimumAvailablePlacementCount: 1,
          singleAvailablePlacementRoundCount: 5,
          firstEliminationEmptyCellRatio: 35 / 81,
        },
      },
    ],
    [
      "対応した手筋では解き切れない一意解の問題",
      boardFromString(
        "1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..",
      ),
      { status: "unsupported", scale: { clueCount: 23, emptyCellCount: 58 } },
    ],
    [
      "解が2つ以上ある問題",
      boardFromString(`123456789${".".repeat(72)}`),
      {
        status: "invalid",
        reason: "multiple-solutions",
        scale: { clueCount: 9, emptyCellCount: 72 },
      },
    ],
    [
      "解が無い問題",
      boardFromString(`11${".".repeat(79)}`),
      {
        status: "invalid",
        reason: "no-solution",
        scale: { clueCount: 2, emptyCellCount: 79 },
      },
    ],
  ];

  test.each(cases)("%s を分析すること", (_, clues, expected) => {
    const result = analyzeNanpureDifficulty(clues);

    expect(result).toEqual(expected);
  });
});

describe("findLongestStreak", () => {
  const rounds = [
    "hidden-single-block",
    "locked-candidates",
    "locked-candidates",
    "naked-single",
    "naked-pair",
  ].map((technique) => ({ technique }) as unknown as NanpureHumanSolveRound);

  test("条件を満たすラウンドが続いた最長の回数を返すこと", () => {
    const result = findLongestStreak(
      rounds,
      (round) => round.technique === "locked-candidates",
    );

    expect(result).toBe(2);
  });
});

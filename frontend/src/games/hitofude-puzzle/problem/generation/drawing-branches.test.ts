import { analyzeHitofudePuzzleDrawingBranches } from "@/games/hitofude-puzzle/problem/generation/drawing-branches";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 製品の分析が同じ盤面に返した分岐（回帰の確認）。人間向け解法器の推論を意図して変えたら取り直す。
 * 盤面は TypeScript の生成器で作った穴だけの問題を、同型の正規化キーの向きで書いた。
 */
const regressionFixtures = [
  {
    name: "5×5・迷う分岐が無い（提供範囲外）",
    rows: ["# . # . .", ". . . . .", ". . . . .", ". . # . .", "# S . . ."],
    expected: {
      branchCount: 0,
      fatalBranchCount: 0,
      fatalBranchCountByStage: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: 0,
    },
  },
  {
    name: "7×7・2辺カットで退ける誤り手がある",
    rows: [
      ". . # . . . .",
      ". . . # # . .",
      ". . . . . . .",
      ". . . . . . .",
      ". . . . S . .",
      ". # . . . . .",
      ". . . # . . .",
    ],
    expected: {
      branchCount: 8,
      fatalBranchCount: 8,
      fatalBranchCountByStage: { 2: 7, 3: 1, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: 30,
    },
  },
  {
    name: "8×8・1段仮置きで退ける誤り手があり、誤進入が探索の上限に達する",
    rows: [
      ". # . . . . . .",
      ". . . . . . # .",
      "# # . . . . # .",
      ". . . . . . . .",
      ". . . . . # . .",
      ". . . . . . . #",
      ". . . . . . . .",
      ". . . S . . . .",
    ],
    expected: {
      branchCount: 12,
      fatalBranchCount: 12,
      fatalBranchCountByStage: { 2: 11, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: null,
    },
  },
  {
    name: "8×8・局所の推論だけで決まるが誤進入が探索の上限に達する",
    rows: [
      "# . # . . # . .",
      ". . . . S # . .",
      ". . . . # . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . # . .",
      "# . . . . . . .",
    ],
    expected: {
      branchCount: 14,
      fatalBranchCount: 14,
      fatalBranchCountByStage: { 2: 14, 3: 0, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: null,
    },
  },
  {
    name: "7×7・分岐が2つだけ",
    rows: [
      "# # # . . . .",
      ". . . . . . #",
      ". . . # # . .",
      ". . # . . . .",
      ". . # . . . .",
      ". . . . # # .",
      ". . . . S . .",
    ],
    expected: {
      branchCount: 2,
      fatalBranchCount: 2,
      fatalBranchCountByStage: { 2: 1, 3: 1, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: 28,
    },
  },
] as const;

describe("analyzeHitofudePuzzleDrawingBranches", () => {
  describe("分岐を数えた固定盤面の場合", () => {
    const cases = regressionFixtures.map(({ name, rows, expected }) => {
      const board = parseHitofudePuzzleBoard(rows);
      const solution = countHitofudePuzzleSolutions(board).firstSolutions[0]!;
      return { name, board, solution, expected };
    });

    test.each(cases)(
      "$name で数えたときと同じ分岐を数えること",
      ({ board, solution, expected }) => {
        const branches = analyzeHitofudePuzzleDrawingBranches(board, solution);

        expect(branches).toEqual(expected);
      },
    );
  });

  describe("推論を進めた回数が上限に達した場合", () => {
    const board = parseHitofudePuzzleBoard(regressionFixtures[2].rows);
    const solution = countHitofudePuzzleSolutions(board).firstSolutions[0]!;

    test("作業量の上限に達したことを返すこと", () => {
      const branches = analyzeHitofudePuzzleDrawingBranches(board, solution, {
        workLimit: 1,
      });

      expect(branches).toBe("work-limit-reached");
    });
  });
});

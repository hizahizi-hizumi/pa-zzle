import { analyzeHamiltonianPathDrawingBranches } from "@/games/hamiltonian-path/problem/generation/drawing-branches";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

/**
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `decision_profile`（一意解）が、同じ盤面に返した分岐。
 * 盤面は TypeScript の生成器で作った穴だけの問題を、同型の正規化キーの向きで書いた。
 * `longestTrapLength` の `null` は、Python が探索の上限で打ち切ったときの `99`。
 */
const pythonFixtures = [
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
    name: "7×7・1段仮置きで退ける誤り手がある（レベル3）",
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
      fatalBranchCountByStage: { 2: 7, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: 30,
    },
  },
  {
    name: "8×8・仮置き8回・誤進入が探索の上限に達する（レベル5）",
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
    name: "7×7・分岐が2つだけ（レベル4）",
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
      fatalBranchCountByStage: { 2: 1, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: 28,
    },
  },
] as const;

describe("analyzeHamiltonianPathDrawingBranches", () => {
  describe("研究用 Python が出力した固定盤面の場合", () => {
    const cases = pythonFixtures.map(({ name, rows, expected }) => {
      const board = parseHamiltonianPathBoard(rows);
      const solution = countHamiltonianPathSolutions(board).firstSolutions[0]!;
      return { name, board, solution, expected };
    });

    test.each(cases)(
      "$name で研究用 Python と同じ分岐を数えること",
      ({ board, solution, expected }) => {
        const branches = analyzeHamiltonianPathDrawingBranches(board, solution);

        expect(branches).toEqual(expected);
      },
    );
  });

  describe("推論を進めた回数が上限に達した場合", () => {
    const board = parseHamiltonianPathBoard(pythonFixtures[2].rows);
    const solution = countHamiltonianPathSolutions(board).firstSolutions[0]!;

    test("作業量の上限に達したことを返すこと", () => {
      const branches = analyzeHamiltonianPathDrawingBranches(board, solution, {
        workLimit: 1,
      });

      expect(branches).toBe("work-limit-reached");
    });
  });
});

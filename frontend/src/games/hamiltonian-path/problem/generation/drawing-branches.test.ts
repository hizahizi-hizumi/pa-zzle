import { analyzeHamiltonianPathDrawingBranches } from "@/games/hamiltonian-path/problem/generation/drawing-branches";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

/**
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `decision_profile`（一意解）が、同じ盤面に返した分岐。
 * `longestTrapLength` の `null` は、Python が探索の上限で打ち切ったときの `99`。
 */
const pythonFixtures = [
  {
    name: "5×5・壁率0.15・迷う分岐が無い（帯1）",
    rows: [
      ". .|. . .",
      "    -",
      ". . . . .",
      "    -   -",
      ". # S . .",
      "",
      ". # # . .",
      "",
      ". . . . #",
    ],
    expected: {
      branchCount: 0,
      fatalBranchCount: 0,
      fatalBranchCountByStage: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: 0,
    },
  },
  {
    name: "7×7・仮置き1回（帯2）",
    rows: [
      ". . . .|. .|.",
      "",
      ". . . . . . .",
      "      -",
      ".|. . . . . .",
      "  -   -   -",
      ".|. . . . . .",
      "      -",
      ". . . . .|. S",
      "    -",
      ". . . . . . .",
      "",
      ". . . . . . .",
    ],
    expected: {
      branchCount: 8,
      fatalBranchCount: 8,
      fatalBranchCountByStage: { 2: 7, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: 38,
    },
  },
  {
    name: "8×8・仮置き7回（帯5）",
    rows: [
      ". .|. . . . . .",
      "      -",
      ". . . .|. . . .",
      "            -",
      ". . S . . . . .",
      "        -",
      ". . . .|.|. . .",
      "    -",
      ". . . . . .|. .",
      "          -",
      ". .|. . . . . .",
      "  -     -",
      ". . . . . .|. .",
      "    -",
      ". . . . . . . .",
    ],
    expected: {
      branchCount: 17,
      fatalBranchCount: 17,
      fatalBranchCountByStage: { 2: 16, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: 45,
    },
  },
  {
    name: "8×8・1段仮置きを重ねても退けられない誤り手がある（帯5）",
    rows: [
      ". . . .|. . . .",
      "-",
      ". . . . .|. . .",
      "",
      ". . .|.|. .|. .",
      "",
      ". .|. . . . . .",
      "        -",
      ".|. . . . .|. .",
      "",
      ". . . . . . . .",
      "    -     -",
      ". . . S . .|. .",
      "",
      ". . . . . . . .",
    ],
    expected: {
      branchCount: 15,
      fatalBranchCount: 15,
      fatalBranchCountByStage: { 2: 13, 3: 0, 4: 0, 5: 1, 6: 1 },
      longestTrapLength: null,
    },
  },
  {
    name: "8×8・仮置き13回・20手を超える先読み（帯5）",
    rows: [
      ". . . . . . . .",
      "",
      ". . . . . . . .",
      "    -       -",
      ". .|. . . . . .",
      "",
      ". . . .|. . . .",
      "-       -     -",
      ". . . . S . . .",
      "        -",
      ".|. . .|.|. . .",
      "",
      ". . . . . . .|.",
      "    -     -",
      ". . . . . . . .",
    ],
    expected: {
      branchCount: 12,
      fatalBranchCount: 12,
      fatalBranchCountByStage: { 2: 11, 3: 0, 4: 0, 5: 0, 6: 1 },
      longestTrapLength: 58,
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

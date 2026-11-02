import { analyzeHamiltonianPathDifficulty } from "@/games/hamiltonian-path/problem/difficulty-analysis";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

describe("analyzeHamiltonianPathDifficulty", () => {
  describe("一意解の問題の場合", () => {
    // 研究用 Python の HumanSolver で仮置き1回、decision_profile で分岐8（1段仮置きで退ける誤り手が1つ）の盤面。
    const problem = parseHamiltonianPathBoard([
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
    ]);

    test("規模と推論と描画視点の分岐の特徴を返すこと", () => {
      const result = analyzeHamiltonianPathDifficulty(problem);

      expect(result).toEqual({
        status: "analyzed",
        scale: {
          size: 7,
          cellCount: 49,
          openCellCount: 49,
          wallCount: 0,
          partitionCount: 11,
        },
        reasoning: {
          localReasoningSuffices: false,
          regionalReasoningUsed: false,
          assumptionCount: 1,
          deepAssumptionCount: 0,
          longestRefutationLength: 5,
          refutationLengths: [5],
          stallCount: 1,
          firstStallDecidedEdgeRatio: 40 / 73,
          firingCountByStage: { 1: 47, 2: 5, 3: 0, 4: 0, 5: 1, 6: 0 },
        },
        drawing: {
          branchCount: 8,
          fatalBranchCount: 8,
          fatalBranchCountByStage: { 2: 7, 3: 0, 4: 0, 5: 1, 6: 0 },
          longestTrapLength: 38,
        },
      });
    });

    test("推論を進めた回数が上限に達したら評価不能とすること", () => {
      const result = analyzeHamiltonianPathDifficulty(problem, {
        workLimit: 10,
      });

      expect(result).toMatchObject({
        status: "unsupported",
        reason: "computation-limit",
      });
    });
  });

  describe("仕切りの無い全面盤の場合", () => {
    const problem = parseHamiltonianPathBoard([
      "S . . .",
      "",
      ". . . .",
      "",
      ". . . .",
      "",
      ". . . .",
    ]);

    test("解が2つ以上あるので成立しない問題とすること", () => {
      const result = analyzeHamiltonianPathDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "multiple-solutions",
      });
    });
  });

  describe("始点の色が多い側でない盤面の場合", () => {
    // 3×3 は市松模様の色が5マスと4マスで、道は5マスの色から始まり5マスの色で終わる。
    const problem = parseHamiltonianPathBoard([
      ". S .",
      "",
      ". . .",
      "",
      ". . .",
    ]);

    test("解が無いので成立しない問題とすること", () => {
      const result = analyzeHamiltonianPathDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "no-solution",
      });
    });
  });
});

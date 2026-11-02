import {
  analyzeHamiltonianPathDifficulty,
  getHamiltonianPathSolveWorkload,
  type HamiltonianPathAnalyzedDifficulty,
} from "@/games/hamiltonian-path/problem/difficulty-analysis";
import { traceHamiltonianPathHumanSolve } from "@/games/hamiltonian-path/problem/generation/human-solver";
import { listHamiltonianPathBoardSymmetries } from "@/games/hamiltonian-path/problem/generation/symmetry";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { createHamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

/**
 * 研究用 Python の HumanSolver で仮置き1回、decision_profile で分岐8（1段仮置きで退ける誤り手が1つ）の盤面。
 * 回転・反転すると、解法器は仮置き1回・2回・4回のいずれかで道を決める。
 */
const pythonFixtureProblem = parseHamiltonianPathBoard([
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

describe("analyzeHamiltonianPathDifficulty", () => {
  describe("一意解の問題の場合", () => {
    const problem = pythonFixtureProblem;

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

  describe("回転・反転した盤面の場合", () => {
    const cases = [
      ["研究用 Python の盤面", pythonFixtureProblem],
      [
        "hp-7-0-782",
        generateHamiltonianPathProblem(
          createHamiltonianPathProblemIdentity(7, 0, 782),
        ).problem,
      ],
    ] as const;
    const heavilyReadOrientation =
      listHamiltonianPathBoardSymmetries(pythonFixtureProblem)[2]!;

    test.each(cases)(
      "%s のどの向きからも、同じ分析結果と作業の量を返すこと",
      (_, problem) => {
        const analyses = listHamiltonianPathBoardSymmetries(problem).map(
          (orientation) => analyzeHamiltonianPathDifficulty(orientation),
        );
        const workloads = analyses.map((analysis) =>
          analysis.status === "analyzed"
            ? getHamiltonianPathSolveWorkload(analysis)
            : null,
        );

        expect(analyses[0]?.status).toBe("analyzed");
        expect(analyses).toEqual(analyses.map(() => analyses[0]));
        expect(workloads).toEqual(workloads.map(() => workloads[0]));
      },
    );

    test("仮置きの多い向きの盤面を、その向きだけで読むと仮置きが4回要ること", () => {
      const trace = traceHamiltonianPathHumanSolve(heavilyReadOrientation);

      expect(trace.assumptionCount).toBe(4);
    });

    test("仮置きの多い向きの盤面からも、最も仮置きの少ない向きの読み方を採ること", () => {
      const result = analyzeHamiltonianPathDifficulty(heavilyReadOrientation);

      expect(result).toMatchObject({
        status: "analyzed",
        reasoning: { assumptionCount: 1, refutationLengths: [5] },
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

describe("getHamiltonianPathSolveWorkload", () => {
  const analysis = {
    status: "analyzed",
    scale: {
      size: 8,
      cellCount: 64,
      openCellCount: 64,
      wallCount: 0,
      partitionCount: 15,
    },
    reasoning: {
      localReasoningSuffices: false,
      regionalReasoningUsed: false,
      assumptionCount: 3,
      deepAssumptionCount: 0,
      longestRefutationLength: 11,
      refutationLengths: [8, 11, 4],
      stallCount: 2,
      firstStallDecidedEdgeRatio: 0.4,
      firingCountByStage: { 1: 60, 2: 8, 3: 0, 4: 0, 5: 3, 6: 0 },
    },
    drawing: {
      branchCount: 12,
      fatalBranchCount: 10,
      fatalBranchCountByStage: { 2: 9, 3: 0, 4: 0, 5: 1, 6: 0 },
      longestTrapLength: 40,
    },
  } as const satisfies HamiltonianPathAnalyzedDifficulty;

  test("なぞる長さ・先読みの回数と量・迷う分岐の数を取り出すこと", () => {
    const workload = getHamiltonianPathSolveWorkload(analysis);

    expect(workload).toEqual({
      openCellCount: 64,
      assumptionCount: 3,
      refutationStepCount: 23,
      longestRefutationLength: 11,
      fatalBranchCount: 10,
    });
  });
});

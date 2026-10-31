import {
  createHamiltonianPathRefuter,
  traceHamiltonianPathHumanSolve,
} from "@/games/hamiltonian-path/problem/generation/human-solver";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import { createHamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

const generatedIdentities = [
  createHamiltonianPathProblemIdentity(5, 0.15, 0),
  createHamiltonianPathProblemIdentity(6, 0, 0),
  createHamiltonianPathProblemIdentity(7, 0.15, 1),
  createHamiltonianPathProblemIdentity(8, 0, 4),
  createHamiltonianPathProblemIdentity(8, 0, 16),
];

/**
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `HumanSolver.solve` が、同じ盤面に返した推論の経過。
 * 盤面は Python の `gen_thin` で作ったものと、TypeScript の生成器で作った問題集合から、帯1〜5・分断の推論・
 * 20手を超える先読みを含むように選んだ。
 */
const pythonFixtures = [
  {
    name: "5×5・局所の推論だけで決まる（帯1）",
    rows: [
      ". . . . .",
      "      -",
      ". . .|. .",
      "    -",
      ".|. . . .",
      "",
      ". . . . .",
      "        -",
      ". . S . .",
    ],
    expected: {
      firingCountByStage: [25, 2, 0, 0, 0, 0],
      decidedEdgeCountByStage: [33, 2, 0, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 0,
      firstStallDecidedEdgeRatio: 1,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 35,
    },
  },
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
      firingCountByStage: [20, 0, 0, 0, 0, 0],
      decidedEdgeCountByStage: [24, 0, 0, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 0,
      firstStallDecidedEdgeRatio: 1,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 24,
    },
  },
  {
    name: "6×6・仮置き5回（帯4）",
    rows: [
      ". . . . . S",
      "",
      ". . .|. . .",
      "    -   -",
      ". . . .|. .",
      "    -   -",
      ".|. . .|. .",
      "",
      ". .|. . . .",
      "",
      ". . . . . .",
    ],
    expected: {
      firingCountByStage: [36, 0, 0, 0, 5, 0],
      decidedEdgeCountByStage: [46, 0, 0, 0, 5, 0],
      assumptionCount: 5,
      deepAssumptionCount: 0,
      refutationLengths: [8, 6, 8, 16, 10],
      stallCount: 5,
      firstStallDecidedEdgeRatio: 0.4117647058823529,
      firstAssumptionDecidedEdgeRatio: 0.4117647058823529,
      edgeCount: 51,
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
      firingCountByStage: [47, 5, 0, 0, 1, 0],
      decidedEdgeCountByStage: [67, 5, 0, 0, 1, 0],
      assumptionCount: 1,
      deepAssumptionCount: 0,
      refutationLengths: [5],
      stallCount: 1,
      firstStallDecidedEdgeRatio: 0.547945205479452,
      firstAssumptionDecidedEdgeRatio: 0.547945205479452,
      edgeCount: 73,
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
      firingCountByStage: [62, 10, 0, 0, 7, 0],
      decidedEdgeCountByStage: [80, 10, 0, 0, 7, 0],
      assumptionCount: 7,
      deepAssumptionCount: 0,
      refutationLengths: [8, 6, 5, 13, 20, 6, 6],
      stallCount: 7,
      firstStallDecidedEdgeRatio: 0.41237113402061853,
      firstAssumptionDecidedEdgeRatio: 0.41237113402061853,
      edgeCount: 97,
    },
  },
  {
    name: "8×8・分断の推論と仮置き7回（帯5）",
    rows: [
      ". . . . . . . .",
      "",
      ". S . .|. . .|.",
      "-           -",
      ". . .|. . . . .",
      "",
      ". . . . . . . .",
      "    -",
      ". . .|. . . . .",
      "",
      ". . . .|.|. . .",
      "        - -   -",
      ". .|. . . . . .",
      "",
      ". . . . . . . .",
    ],
    expected: {
      firingCountByStage: [62, 7, 1, 0, 7, 0],
      decidedEdgeCountByStage: [84, 7, 1, 0, 7, 0],
      assumptionCount: 7,
      deepAssumptionCount: 0,
      refutationLengths: [3, 3, 3, 7, 4, 8, 6],
      stallCount: 8,
      firstStallDecidedEdgeRatio: 0.5959595959595959,
      firstAssumptionDecidedEdgeRatio: 0.5959595959595959,
      edgeCount: 99,
    },
  },
  {
    name: "8×8・壁率0.15・分断の推論で止まりを抜ける（帯2）",
    rows: [
      "# # # . . . . .",
      "",
      ". . . . .|. # .",
      "",
      ".|. .|.|.|.|.|.",
      "",
      ". . . . S . . .",
      "",
      ". . . . # .|. .",
      "",
      ".|. .|. # . . .",
      "              -",
      ". . . . . . . .",
      "",
      "# # # # . . . .",
    ],
    expected: {
      firingCountByStage: [50, 6, 1, 0, 0, 0],
      decidedEdgeCountByStage: [69, 6, 1, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 1,
      firstStallDecidedEdgeRatio: 0.6710526315789473,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 76,
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
      firingCountByStage: [62, 7, 0, 0, 7, 0],
      decidedEdgeCountByStage: [85, 7, 0, 0, 7, 0],
      assumptionCount: 7,
      deepAssumptionCount: 0,
      refutationLengths: [3, 4, 5, 19, 5, 14, 8],
      stallCount: 7,
      firstStallDecidedEdgeRatio: 0.2222222222222222,
      firstAssumptionDecidedEdgeRatio: 0.2222222222222222,
      edgeCount: 99,
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
      firingCountByStage: [63, 4, 0, 0, 13, 0],
      decidedEdgeCountByStage: [81, 4, 0, 0, 13, 0],
      assumptionCount: 13,
      deepAssumptionCount: 0,
      refutationLengths: [3, 3, 7, 4, 8, 5, 7, 10, 8, 17, 32, 15, 20],
      stallCount: 13,
      firstStallDecidedEdgeRatio: 0.35714285714285715,
      firstAssumptionDecidedEdgeRatio: 0.35714285714285715,
      edgeCount: 98,
    },
  },
] as const;

describe("traceHamiltonianPathHumanSolve", () => {
  describe("研究用 Python が出力した固定盤面の場合", () => {
    test.each(pythonFixtures)(
      "$name で研究用 Python と同じ推論の経過をたどること",
      ({ rows, expected }) => {
        const trace = traceHamiltonianPathHumanSolve(
          parseHamiltonianPathBoard(rows),
        );

        expect(trace).toEqual({
          status: "solved",
          ...expected,
          firstStallDecidedEdgeRatio: expect.closeTo(
            expected.firstStallDecidedEdgeRatio,
            12,
          ),
          firstAssumptionDecidedEdgeRatio: expect.closeTo(
            expected.firstAssumptionDecidedEdgeRatio,
            12,
          ),
        });
      },
    );
  });

  describe("生成した一意解の問題の場合", () => {
    const problems = generatedIdentities.map((identity) =>
      generateHamiltonianPathProblem(identity),
    );

    test.each(problems)(
      "$identity.seed を段階1〜6の推論で解き切ること",
      ({ problem }) => {
        const trace = traceHamiltonianPathHumanSolve(problem);

        expect(trace.status).toBe("solved");
      },
    );
  });

  describe("始点がどこへも進めない盤面の場合", () => {
    const board = parseHamiltonianPathBoard(["S|.", "-  ", ". ."]);

    test("矛盾を返すこと", () => {
      const trace = traceHamiltonianPathHumanSolve(board);

      expect(trace.status).toBe("contradiction");
    });
  });

  describe("推論を進めた回数が上限に達した場合", () => {
    const board = parseHamiltonianPathBoard(pythonFixtures[2].rows);

    test("評価不能として打ち切ること", () => {
      const trace = traceHamiltonianPathHumanSolve(board, { workLimit: 10 });

      expect(trace.status).toBe("work-limit-reached");
    });
  });
});

describe("createHamiltonianPathRefuter", () => {
  describe("生成した一意解の問題の解の道の場合", () => {
    const cases = generatedIdentities.map((identity) => {
      const { problem, solution } = generateHamiltonianPathProblem(identity);
      return { seed: identity.seed, problem, solution };
    });

    test.each(cases)(
      "$seed の解の道のどの途中までも反証しないこと",
      ({ problem, solution }) => {
        const refuter = createHamiltonianPathRefuter(problem);

        const refutations = solution
          .slice(1)
          .map((_, index) =>
            refuter.findRefutationStage(solution.slice(0, index + 2)),
          );

        expect(new Set(refutations)).toEqual(new Set([null]));
      },
    );
  });
});

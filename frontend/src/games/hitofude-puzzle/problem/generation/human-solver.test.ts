import {
  createHitofudePuzzleRefuter,
  traceHitofudePuzzleHumanSolve,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import { createHitofudePuzzleProblemIdentity } from "@/games/hitofude-puzzle/problem/problem";
import {
  type HitofudePuzzleBoard,
  listHitofudePuzzleCells,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

const generatedIdentities = [
  createHitofudePuzzleProblemIdentity(5, 0, 0),
  createHitofudePuzzleProblemIdentity(6, 0, 0),
  createHitofudePuzzleProblemIdentity(7, 0, 1),
  createHitofudePuzzleProblemIdentity(8, 0, 4),
  createHitofudePuzzleProblemIdentity(7, 4, 3),
];

/** 4×4 か 5×5 に、穴と始点を無作為に置いた盤面。解が2つ以上ある盤面も含む。 */
function createRandomBoard(seed: string): HitofudePuzzleBoard {
  const random = createProblemSeededRandom(seed);
  const size = random() < 0.5 ? 4 : 5;
  const cells = listHitofudePuzzleCells(size);
  const holes = cells.filter(() => random() < 0.15);
  const openCells = cells.filter((cell) => !holes.includes(cell));
  return {
    size,
    holes,
    start: openCells[Math.floor(random() * openCells.length)]!,
  };
}

/** 解のある無作為盤面と、その解を2本まで。 */
const solvableRandomCases = Array.from({ length: 80 }, (_, index) => {
  const board = createRandomBoard(`human-solver-property-${index}`);
  const { firstSolutions } = countHitofudePuzzleSolutions(board, {
    searchStepLimit: Number.POSITIVE_INFINITY,
  });
  return [index, board, firstSolutions] as const;
}).filter(([, , solutions]) => solutions.length > 0);

/**
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `HumanSolver.solve` が、同じ盤面に返した推論の経過。
 * 盤面は TypeScript の生成器で作った穴だけの問題から、レベル1〜5・迷う分岐の無い問題・20手を超える先読みを含むように選び、
 * 同型の正規化キーの向きで書いた。
 */
const pythonFixtures = [
  {
    name: "6×6・局所の推論だけで決まる（レベル1）",
    rows: [
      "# . # . . .",
      ". . . . . .",
      ". . . . . .",
      ". . S . . .",
      ". . . # . .",
      ". . . . . .",
    ],
    expected: {
      firingCountByStage: [33, 0, 0, 0, 0, 0],
      decidedEdgeCountByStage: [51, 0, 0, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 0,
      firstStallDecidedEdgeRatio: 1,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 51,
    },
  },
  {
    name: "5×5・迷う分岐が無い（提供範囲外）",
    rows: ["# . # . .", ". . . . .", ". . . . .", ". . # . .", "# S . . ."],
    expected: {
      firingCountByStage: [20, 0, 0, 0, 0, 0],
      decidedEdgeCountByStage: [29, 0, 0, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 0,
      firstStallDecidedEdgeRatio: 1,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 29,
    },
  },
  {
    name: "7×7・仮置き1回（レベル2）",
    rows: [
      "# . . . # . .",
      ". . # S . . #",
      ". . . . . . .",
      ". . . . # . .",
      "# . . # # . .",
      ". . . . . . .",
      ". . . . . . .",
    ],
    expected: {
      firingCountByStage: [40, 0, 0, 0, 1, 0],
      decidedEdgeCountByStage: [58, 0, 0, 0, 1, 0],
      assumptionCount: 1,
      deepAssumptionCount: 0,
      refutationLengths: [6],
      stallCount: 1,
      firstStallDecidedEdgeRatio: 0.5932203389830508,
      firstAssumptionDecidedEdgeRatio: 0.5932203389830508,
      edgeCount: 59,
    },
  },
  {
    name: "7×7・仮置き2回（レベル3）",
    rows: [
      ". . # . . . .",
      ". . . # . . .",
      ". . . . . . .",
      ". . . . . . #",
      ". . . . . . .",
      ". # . . . . .",
      ". S . . . . .",
    ],
    expected: {
      firingCountByStage: [45, 3, 0, 0, 2, 0],
      decidedEdgeCountByStage: [65, 3, 0, 0, 2, 0],
      assumptionCount: 2,
      deepAssumptionCount: 0,
      refutationLengths: [5, 8],
      stallCount: 2,
      firstStallDecidedEdgeRatio: 0.35714285714285715,
      firstAssumptionDecidedEdgeRatio: 0.35714285714285715,
      edgeCount: 70,
    },
  },
  {
    name: "7×7・仮置き5回（レベル4）",
    rows: [
      ". # . . . . .",
      ". . . . . . .",
      ". . # S # . .",
      ". . . . . . #",
      ". . . . # . .",
      ". . # . . . .",
      ". . # . . . .",
    ],
    expected: {
      firingCountByStage: [41, 6, 0, 0, 5, 0],
      decidedEdgeCountByStage: [49, 6, 0, 0, 5, 0],
      assumptionCount: 5,
      deepAssumptionCount: 0,
      refutationLengths: [13, 20, 13, 19, 20],
      stallCount: 5,
      firstStallDecidedEdgeRatio: 0.4166666666666667,
      firstAssumptionDecidedEdgeRatio: 0.4166666666666667,
      edgeCount: 60,
    },
  },
  {
    name: "8×8・仮置き8回（レベル5）",
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
      firingCountByStage: [55, 2, 0, 0, 8, 0],
      decidedEdgeCountByStage: [79, 2, 0, 0, 8, 0],
      assumptionCount: 8,
      deepAssumptionCount: 0,
      refutationLengths: [5, 8, 6, 7, 6, 18, 3, 8],
      stallCount: 8,
      firstStallDecidedEdgeRatio: 0.3595505617977528,
      firstAssumptionDecidedEdgeRatio: 0.3595505617977528,
      edgeCount: 89,
    },
  },
  {
    name: "7×7・仮置き9回・20手を超える先読み",
    rows: [
      "# # . . . . .",
      ". . . . . . .",
      ". . . . . . .",
      ". . . . S . #",
      ". . . . . . #",
      ". . . . . . .",
      "# . . . . . #",
    ],
    expected: {
      firingCountByStage: [41, 6, 0, 0, 9, 0],
      decidedEdgeCountByStage: [56, 6, 0, 0, 9, 0],
      assumptionCount: 9,
      deepAssumptionCount: 0,
      refutationLengths: [8, 5, 6, 8, 14, 13, 12, 23, 3],
      stallCount: 9,
      firstStallDecidedEdgeRatio: 0.30985915492957744,
      firstAssumptionDecidedEdgeRatio: 0.30985915492957744,
      edgeCount: 71,
    },
  },
] as const;

describe("traceHitofudePuzzleHumanSolve", () => {
  describe("研究用 Python が出力した固定盤面の場合", () => {
    test.each(pythonFixtures)(
      "$name で研究用 Python と同じ推論の経過をたどること",
      ({ rows, expected }) => {
        const trace = traceHitofudePuzzleHumanSolve(
          parseHitofudePuzzleBoard(rows),
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
      generateHitofudePuzzleProblem(identity),
    );

    test.each(problems)(
      "$identity.seed を段階1〜6の推論で解き切ること",
      ({ problem }) => {
        const trace = traceHitofudePuzzleHumanSolve(problem);

        expect(trace.status).toBe("solved");
      },
    );
  });

  describe("解のある小さな無作為盤面の場合", () => {
    test.each(solvableRandomCases)(
      "盤面 %i で矛盾を返さないこと",
      (_, board) => {
        const trace = traceHitofudePuzzleHumanSolve(board);

        expect(trace.status).not.toBe("contradiction");
      },
    );
  });

  describe("始点がどこへも進めない盤面の場合", () => {
    const board = parseHitofudePuzzleBoard(["S #", "# ."]);

    test("矛盾を返すこと", () => {
      const trace = traceHitofudePuzzleHumanSolve(board);

      expect(trace.status).toBe("contradiction");
    });
  });

  describe("推論を進めた回数が上限に達した場合", () => {
    const board = parseHitofudePuzzleBoard(pythonFixtures[4].rows);

    test("評価不能として打ち切ること", () => {
      const trace = traceHitofudePuzzleHumanSolve(board, { workLimit: 10 });

      expect(trace.status).toBe("work-limit-reached");
    });
  });
});

describe("createHitofudePuzzleRefuter", () => {
  describe("解のある小さな無作為盤面の解の道の場合", () => {
    test.each(solvableRandomCases)(
      "盤面 %i の解の道のどの途中までも反証しないこと",
      (_, board, solutions) => {
        const refuter = createHitofudePuzzleRefuter(board);

        const refutations = solutions.flatMap((solution) =>
          solution.map((_, index) =>
            refuter.findRefutationStage(solution.slice(0, index + 1)),
          ),
        );

        expect(new Set(refutations)).toEqual(new Set([null]));
      },
    );
  });

  describe("始点が関節点で、両側に領域が残る盤面の場合", () => {
    // 残りの6マスは右上と左下の2つの領域に分かれ、始点だけでつながる。始点は道の端なので、両方へは出られない。
    const board = parseHitofudePuzzleBoard(["# . .", ". S .", ". . #"]);

    test("分断・到達（段階3）で初めて反証すること", () => {
      const stage = createHitofudePuzzleRefuter(board).findRefutationStage([
        board.start,
      ]);

      expect(stage).toBe(3);
    });
  });

  describe("関節点で分かれた領域の色の数が、通り抜けに合わない盤面の場合", () => {
    // 盤面全体の色の数は道に合う。始点の両隣はどちらも始点のほかに隣が1つしかなく、始点から出なかった側が終点に決まり、
    // その手前のマスが関節点になる。関節点で分かれた領域の色の数が、領域を通り抜ける道に合わない。
    const board = parseHitofudePuzzleBoard([
      "# . S .",
      "# . # .",
      ". . . .",
      ". . . .",
    ]);

    test("パリティ（段階4）で初めて反証すること", () => {
      const stage = createHitofudePuzzleRefuter(board).findRefutationStage([
        board.start,
      ]);

      expect(stage).toBe(4);
    });
  });

  describe("生成した一意解の問題の解の道の場合", () => {
    const cases = generatedIdentities.map((identity) => {
      const { problem, solution } = generateHitofudePuzzleProblem(identity);
      return { seed: identity.seed, problem, solution };
    });

    test.each(cases)(
      "$seed の解の道のどの途中までも反証しないこと",
      ({ problem, solution }) => {
        const refuter = createHitofudePuzzleRefuter(problem);

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

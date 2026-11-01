import {
  _private,
  createHitofudePuzzleRefuter,
  traceHitofudePuzzleHumanSolve,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import { countHitofudePuzzleSolutions } from "@/games/hitofude-puzzle/problem/generation/solver";
import { listHitofudePuzzleBoardSymmetries } from "@/games/hitofude-puzzle/problem/generation/symmetry";
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

const { deduceHitofudePuzzleEdges } = _private;

/** 解の道が使う辺を、両端のマスの組（小さい方が先）で挙げる。 */
function listPathEdges(path: readonly number[]): string[] {
  return path
    .slice(1)
    .map((cell, index) =>
      [Math.min(cell, path[index]!), Math.max(cell, path[index]!)].join("-"),
    );
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
 * 製品の解法器が同じ盤面に返した推論の経過（回帰の確認）。推論や数え方を意図して変えたら取り直す。
 * 盤面は穴の問題から、局所の推論だけ・迷う分岐の無い問題・2辺カット・仮置きの局面の数・20手を超える先読みを含むように選び、
 * 同型の正規化キーの向きで書いた。
 */
const regressionFixtures = [
  {
    name: "6×6・局所の推論だけで決まる",
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
    name: "5×5・迷う分岐が無い",
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
    name: "7×7・2辺カットで止まりを抜ける",
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
      firingCountByStage: [39, 0, 1, 0, 0, 0],
      decidedEdgeCountByStage: [57, 0, 2, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 1,
      firstStallDecidedEdgeRatio: 0.5932203389830508,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 59,
    },
  },
  {
    name: "7×7・仮置き1局面",
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
      firingCountByStage: [42, 2, 2, 0, 1, 0],
      decidedEdgeCountByStage: [59, 2, 4, 0, 5, 0],
      assumptionCount: 1,
      deepAssumptionCount: 0,
      refutationLengths: [5],
      stallCount: 2,
      firstStallDecidedEdgeRatio: 0.3571428571428571,
      firstAssumptionDecidedEdgeRatio: 0.3571428571428571,
      edgeCount: 70,
    },
  },
  {
    name: "7×7・閉路の禁止と2辺カットだけで決まる",
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
      firingCountByStage: [40, 10, 1, 0, 0, 0],
      decidedEdgeCountByStage: [48, 10, 2, 0, 0, 0],
      assumptionCount: 0,
      deepAssumptionCount: 0,
      refutationLengths: [],
      stallCount: 1,
      firstStallDecidedEdgeRatio: 0.41666666666666663,
      firstAssumptionDecidedEdgeRatio: 1,
      edgeCount: 60,
    },
  },
  {
    name: "8×8・仮置き3局面",
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
      firingCountByStage: [47, 1, 0, 0, 3, 0],
      decidedEdgeCountByStage: [67, 1, 0, 0, 21, 0],
      assumptionCount: 3,
      deepAssumptionCount: 0,
      refutationLengths: [5, 6, 9],
      stallCount: 3,
      firstStallDecidedEdgeRatio: 0.3595505617977528,
      firstAssumptionDecidedEdgeRatio: 0.3595505617977528,
      edgeCount: 89,
    },
  },
  {
    name: "7×7・仮置き3局面・20手を超える先読み",
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
      firingCountByStage: [30, 0, 0, 0, 3, 0],
      decidedEdgeCountByStage: [45, 0, 0, 0, 26, 0],
      assumptionCount: 3,
      deepAssumptionCount: 0,
      refutationLengths: [5, 12, 21],
      stallCount: 3,
      firstStallDecidedEdgeRatio: 0.3098591549295775,
      firstAssumptionDecidedEdgeRatio: 0.3098591549295775,
      edgeCount: 71,
    },
  },
] as const;

describe("traceHitofudePuzzleHumanSolve", () => {
  describe("推論の経過を取った固定盤面の場合", () => {
    test.each(regressionFixtures)(
      "$name で取ったときと同じ推論の経過をたどること",
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

  describe("仮置きを要する固定盤面を回転・反転した場合", () => {
    const cases = regressionFixtures
      .filter(({ expected }) => expected.assumptionCount > 0)
      .map(({ name, rows, expected }) => ({
        name,
        orientations: listHitofudePuzzleBoardSymmetries(
          parseHitofudePuzzleBoard(rows),
        ),
        assumptionCount: expected.assumptionCount,
      }));

    test.each(cases)(
      "$name をどの向きから読んでも、仮置きの局面の数が同じであること",
      ({ orientations, assumptionCount }) => {
        const counts = orientations.map(
          (orientation) =>
            traceHitofudePuzzleHumanSolve(orientation).assumptionCount,
        );

        expect(counts).toEqual(counts.map(() => assumptionCount));
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
    const board = parseHitofudePuzzleBoard(regressionFixtures[4].rows);

    test("評価不能として打ち切ること", () => {
      const trace = traceHitofudePuzzleHumanSolve(board, { workLimit: 10 });

      expect(trace.status).toBe("work-limit-reached");
    });
  });
});

describe("deduceHitofudePuzzleEdges", () => {
  describe("2本の辺だけで残りとつながる、端も終点候補も無い領域がある盤面の場合", () => {
    // 右の袋小路（14・24 が穴）で終点が 19 に決まる。上の領域は 5-10 と 12-17 の2本だけで残りとつながり、端を含まない。
    const board = parseHitofudePuzzleBoard([
      ". . . . .",
      ". . . . .",
      "S # . . #",
      ". . . . .",
      ". . . . #",
    ]);
    const cutEdges = [
      [5, 10],
      [12, 17],
    ] as const;

    test("局所の推論（段階2まで）では2本を決めないこと", () => {
      const deduced = deduceHitofudePuzzleEdges(board, [board.start], 2);

      expect(deduced?.used).not.toEqual(expect.arrayContaining([cutEdges[0]]));
      expect(deduced?.used).not.toEqual(expect.arrayContaining([cutEdges[1]]));
    });

    test("分断の推論（段階3）で、通り抜けるために2本とも使うと決めること", () => {
      const deduced = deduceHitofudePuzzleEdges(board, [board.start], 3);

      expect(deduced?.used).toEqual(expect.arrayContaining([...cutEdges]));
    });
  });

  describe("2本の辺だけで残りとつながる領域に終点があり、1本を使うと決まった盤面の場合", () => {
    // 左下の袋小路（31 が穴）で終点が 30 に決まる。下の領域は 13-19 と 17-23 の2本だけで残りとつながり、終点を含む。
    // 17 は隣が2つしかないので 17-23 を使う。
    const board = parseHitofudePuzzleBoard([
      ". . . . . .",
      ". . S . . .",
      ". . # # # .",
      "# . . . . .",
      ". . . . . .",
      ". # . . . .",
    ]);
    const enteringEdge = [17, 23] as const;
    const otherEdge = [13, 19] as const;

    test("局所の推論（段階2まで）では、もう1本を決めないこと", () => {
      const deduced = deduceHitofudePuzzleEdges(board, [board.start], 2);

      expect(deduced?.used).toEqual(expect.arrayContaining([enteringEdge]));
      expect([...deduced!.used, ...deduced!.unused]).not.toEqual(
        expect.arrayContaining([otherEdge]),
      );
    });

    test("分断の推論（段階3）で、入って終わるのでもう1本を使わないと決めること", () => {
      const deduced = deduceHitofudePuzzleEdges(board, [board.start], 3);

      expect(deduced?.unused).toEqual(expect.arrayContaining([otherEdge]));
    });
  });

  describe("一意解の小さな無作為盤面の解の道の場合", () => {
    const cases = solvableRandomCases.flatMap(([index, board, solutions]) =>
      solutions.length === 1
        ? [
            [
              index,
              board,
              solutions[0]!,
              new Set(listPathEdges(solutions[0]!)),
            ] as const,
          ]
        : [],
    );

    test.each(cases)(
      "盤面 %i の解の道のどの途中からも、段階1〜4で解と食い違う辺を決めないこと",
      (_, board, solution, solutionEdges) => {
        const disagreements = solution.flatMap((_, index) => {
          const deduced = deduceHitofudePuzzleEdges(
            board,
            solution.slice(0, index + 1),
            4,
          );
          return deduced === null
            ? ["矛盾"]
            : [
                ...deduced.used
                  .map((edge) => edge.join("-"))
                  .filter((edge) => !solutionEdges.has(edge)),
                ...deduced.unused
                  .map((edge) => edge.join("-"))
                  .filter((edge) => solutionEdges.has(edge)),
              ];
        });

        expect(disagreements).toEqual([]);
      },
    );
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

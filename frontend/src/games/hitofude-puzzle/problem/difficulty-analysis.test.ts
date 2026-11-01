import {
  analyzeHitofudePuzzleDifficulty,
  getHitofudePuzzleSolveWorkload,
  type HitofudePuzzleAnalyzedDifficulty,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { traceHitofudePuzzleHumanSolve } from "@/games/hitofude-puzzle/problem/generation/human-solver";
import { listHitofudePuzzleBoardSymmetries } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import { createHitofudePuzzleProblemIdentity } from "@/games/hitofude-puzzle/problem/problem";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

/** 2辺カットで1度止まりを抜け、仮置き1局面（先読み5手）で決まる盤面。どの向きから読んでも同じ経過になる。 */
const fixtureProblem = parseHitofudePuzzleBoard([
  ". . # . . . .",
  ". . . # . . .",
  ". . . . . . .",
  ". . . . . . #",
  ". . . . . . .",
  ". # . . . . .",
  ". S . . . . .",
]);

/**
 * 向きで読み方が変わる盤面（版 2 の問題集の `hp-7-t4-14` を同型の正規化キーの向きで書いたもの）。この向きでは仮置き2局面
 * （5手と10手）、最も上手な向きでは仮置き1局面（5手）で道を決める。
 */
const orientationDependentProblem = parseHitofudePuzzleBoard([
  "# . . . . . .",
  ". . # . . . #",
  ". . . . S . #",
  ". . # . . . .",
  ". . # . . . .",
  ". . . . # . .",
  ". . . . # . .",
]);

describe("analyzeHitofudePuzzleDifficulty", () => {
  describe("一意解の問題の場合", () => {
    const problem = fixtureProblem;

    test("規模と推論と描画視点の分岐の特徴を返すこと", () => {
      const result = analyzeHitofudePuzzleDifficulty(problem);

      expect(result).toEqual({
        status: "analyzed",
        scale: {
          size: 7,
          cellCount: 49,
          openCellCount: 45,
          holeCount: 4,
        },
        reasoning: {
          localReasoningSuffices: false,
          regionalReasoningUsed: true,
          assumptionCount: 1,
          deepAssumptionCount: 0,
          longestRefutationLength: 5,
          refutationLengths: [5],
          stallCount: 2,
          firstStallDecidedEdgeRatio: expect.closeTo(25 / 70, 12),
          firingCountByStage: { 1: 41, 2: 2, 3: 2, 4: 0, 5: 1, 6: 0 },
        },
        drawing: {
          branchCount: 5,
          fatalBranchCount: 5,
          fatalBranchCountByStage: { 2: 5, 3: 0, 4: 0, 5: 0, 6: 0 },
          longestTrapLength: 29,
        },
      });
    });

    test("推論を進めた回数が上限に達したら評価不能とすること", () => {
      const result = analyzeHitofudePuzzleDifficulty(problem, {
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
      ["向きで読み方が変わる盤面", orientationDependentProblem],
      [
        "hp-7-t0-19",
        generateHitofudePuzzleProblem(
          createHitofudePuzzleProblemIdentity(7, 0, 19),
        ).problem,
      ],
    ] as const;
    const heavilyReadOrientation = orientationDependentProblem;

    test.each(cases)(
      "%s のどの向きからも、同じ分析結果と作業の量を返すこと",
      (_, problem) => {
        const analyses = listHitofudePuzzleBoardSymmetries(problem).map(
          (orientation) => analyzeHitofudePuzzleDifficulty(orientation),
        );
        const workloads = analyses.map((analysis) =>
          analysis.status === "analyzed"
            ? getHitofudePuzzleSolveWorkload(analysis)
            : null,
        );

        expect(analyses[0]?.status).toBe("analyzed");
        expect(analyses).toEqual(analyses.map(() => analyses[0]));
        expect(workloads).toEqual(workloads.map(() => workloads[0]));
      },
    );

    test("仮置きの多い向きの盤面を、その向きだけで読むと仮置きが2局面要ること", () => {
      const trace = traceHitofudePuzzleHumanSolve(heavilyReadOrientation);

      expect(trace.assumptionCount).toBe(2);
    });

    test("仮置きの多い向きの盤面からも、最も仮置きの少ない向きの読み方を採ること", () => {
      const result = analyzeHitofudePuzzleDifficulty(heavilyReadOrientation);

      expect(result).toMatchObject({
        status: "analyzed",
        reasoning: { assumptionCount: 1, refutationLengths: [5] },
      });
    });
  });

  describe("穴の無い全面盤の場合", () => {
    const problem = parseHitofudePuzzleBoard([
      "S . . .",
      ". . . .",
      ". . . .",
      ". . . .",
    ]);

    test("解が2つ以上あるので成立しない問題とすること", () => {
      const result = analyzeHitofudePuzzleDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "multiple-solutions",
      });
    });
  });

  describe("始点の色が多い側でない盤面の場合", () => {
    // 3×3 は市松模様の色が5マスと4マスで、道は5マスの色から始まり5マスの色で終わる。
    const problem = parseHitofudePuzzleBoard([". S .", ". . .", ". . ."]);

    test("解が無いので成立しない問題とすること", () => {
      const result = analyzeHitofudePuzzleDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "no-solution",
      });
    });
  });
});

describe("getHitofudePuzzleSolveWorkload", () => {
  const analysis = {
    status: "analyzed",
    scale: {
      size: 8,
      cellCount: 64,
      openCellCount: 64,
      holeCount: 0,
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
  } as const satisfies HitofudePuzzleAnalyzedDifficulty;

  test("なぞる長さ・先読みの回数と量・迷う分岐の数を取り出すこと", () => {
    const workload = getHitofudePuzzleSolveWorkload(analysis);

    expect(workload).toEqual({
      openCellCount: 64,
      assumptionCount: 3,
      refutationStepCount: 23,
      longestRefutationLength: 11,
      fatalBranchCount: 10,
    });
  });
});

import {
  assessShuttleParkingDifficulty,
  SHUTTLE_PARKING_CLASSIFICATION_RULES,
} from "@/games/shuttle-parking/difficulty";
import { analyzeShuttleParkingDifficulty } from "@/games/shuttle-parking/problem/difficulty-analysis";
import { SHUTTLE_PARKING_RESEARCH_RULES } from "@/games/shuttle-parking/problem/generation/naive-rules";
import { findShuttleParkingMinimumBays } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import type {
  ShuttleParkingCapacity,
  ShuttleParkingColor,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import reference from "@/games/shuttle-parking/puzzle/research-reference.json";

// 期待値は docs/パズル/導入調査/送迎パーキング/調査コード/shuttle-parking_difficulty.expected.json（案H の150問、検査 F2）。
// 調査コードの状態の数（states）は局面の持ち方で変わるので比べない。

type ReferenceProblem = (typeof reference.problems)[number];

function toProblem(
  problem: ReferenceProblem,
  bayCount: number,
): ShuttleParkingProblem {
  return {
    lot: {
      size: problem.size,
      openSides: problem.openSides as ShuttleParkingSide[],
      cars: problem.cars.map(([row, column, orientation, capacity, color]) => ({
        row: row as number,
        column: column as number,
        orientation: orientation === "h" ? "horizontal" : "vertical",
        capacity: capacity as ShuttleParkingCapacity,
        color: color as ShuttleParkingColor,
      })),
    },
    passengers: Array.from(problem.passengers) as ShuttleParkingColor[],
    bayCount,
  };
}

const researchRules = {
  rules: SHUTTLE_PARKING_RESEARCH_RULES,
  tieBreaks: "uniform" as const,
  checksFreePath: false,
};

const analyzedProblems = reference.problems.flatMap((problem) =>
  "rules" in problem && problem.rules !== undefined ? [problem] : [],
);

describe("findShuttleParkingMinimumBays", () => {
  test.each(
    reference.problems.map((problem) => [problem.seed, problem] as const),
  )("%s の解ける最小の待機枠が調査コードと一致すること", (_, problem) => {
    const minimum = findShuttleParkingMinimumBays(toProblem(problem, 4));

    expect(minimum).toBe(problem.minimumBayCount);
  });
});

describe("analyzeShuttleParkingDifficulty", () => {
  describe.each(
    analyzedProblems.map((problem) => [problem.seed, problem] as const),
  )("%s の場合", (_, problem) => {
    const analysis = analyzeShuttleParkingDifficulty(
      toProblem(problem, problem.minimumBayCount),
    );
    const features = analysis.status === "analyzed" ? analysis.features : null;

    test("素朴な規則8つの勝率が調査コードと一致すること", () => {
      const rules = Object.fromEntries(
        SHUTTLE_PARKING_RESEARCH_RULES.map((rule) => [
          rule,
          features?.rules[rule],
        ]),
      );

      expect(rules).toEqual(problem.rules);
    });

    test("勝ち筋の上の判断の回数が調査コードと一致すること", () => {
      const decisions = features && {
        best: features.decisions.best,
        cont: features.decisions.continuation,
        window: features.decisions.window,
      };

      expect(decisions).toMatchObject(problem.decisions);
    });

    test("調査コードと同じ決まりの判定で、レベルと範囲外のわけが調査コードと一致すること", () => {
      const assessment = assessShuttleParkingDifficulty(
        analysis,
        researchRules,
      );

      expect(assessment).toEqual(
        problem.level === null
          ? { status: "out-of-range", reason: problem.reason }
          : { status: "classified", difficulty: String(problem.level) },
      );
    });
  });
});

describe("assessShuttleParkingDifficulty", () => {
  test("製品の判定は、調査の判定で分類した問題を、低いレベルへ動かさないこと", () => {
    const moved = analyzedProblems.flatMap((problem) => {
      const analysis = analyzeShuttleParkingDifficulty(
        toProblem(problem, problem.minimumBayCount),
      );
      const research = assessShuttleParkingDifficulty(analysis, researchRules);
      const product = assessShuttleParkingDifficulty(
        analysis,
        SHUTTLE_PARKING_CLASSIFICATION_RULES,
      );
      return research.status === "classified" &&
        product.status === "classified" &&
        research.difficulty !== product.difficulty
        ? [problem.seed]
        : [];
    });

    expect(moved).toEqual([]);
  });
});

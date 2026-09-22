import {
  isCompleteWaterSortBottle,
  isStandardWaterSortInitialState,
} from "../puzzle/state";
import { generateWaterSortProblem, restoreWaterSortProblem } from "./generator";

describe("generateWaterSortProblem", () => {
  const reproducibleOptions = {
    seed: "water-sort-reproducible-seed",
    colorCount: 3,
  } as const;
  const standardStateOptions = {
    seed: "water-sort-standard-state",
    colorCount: 4,
  } as const;
  const rejectAllOptions = {
    seed: "water-sort-reject-all",
    colorCount: 3,
    maximumAttempts: 2,
    acceptCandidate: () => false,
  } as const;

  test("同じseedと生成条件から同じ問題と解析結果を再現すること", () => {
    const first = generateWaterSortProblem(reproducibleOptions);
    const second = generateWaterSortProblem(reproducibleOptions);

    expect(second).toEqual(first);
  });

  test("標準初期形を満たし最初から完成した色入りボトルを含まないこと", () => {
    const problem = generateWaterSortProblem(standardStateOptions);
    const standard = isStandardWaterSortInitialState(
      problem.problem.initialState,
      problem.identity.conditions.colorCount,
    );
    const hasCompletedBottle = problem.problem.initialState.some(
      isCompleteWaterSortBottle,
    );

    expect(standard).toBe(true);
    expect(hasCompletedBottle).toBe(false);
    expect(problem.difficultyAnalysis.shortestMoveCount).toBe(
      problem.optimalMoveCount,
    );
  });

  describe("2件目の解ける候補だけを採用する場合", () => {
    let solvedCandidateCount: number;
    let acceptCandidate: () => boolean;

    beforeEach(() => {
      solvedCandidateCount = 0;
      acceptCandidate = () => {
        solvedCandidateCount += 1;
        return solvedCandidateCount >= 2;
      };
    });

    test("生成器と独立した採用条件で候補を棄却できること", () => {
      const problem = generateWaterSortProblem({
        seed: "water-sort-acceptance-policy",
        colorCount: 3,
        acceptCandidate,
      });

      expect(solvedCandidateCount).toBe(2);
      expect(problem.identity.generationAttempt).toBeGreaterThan(1);
    });

    test("保存した問題識別情報から採用条件に依存せず同じ問題を再現すること", () => {
      const problem = generateWaterSortProblem({
        seed: "water-sort-acceptance-policy",
        colorCount: 3,
        acceptCandidate,
      });
      const identity = {
        generatorVersion: problem.identity.generatorVersion,
        seed: problem.identity.seed,
        conditions: problem.identity.conditions,
        generationAttempt: problem.identity.generationAttempt,
      };

      const reproduced = restoreWaterSortProblem(identity);

      expect(reproduced).toEqual(problem);
    });
  });

  test("採用条件を満たす候補が上限内に無ければ失敗を返すこと", () => {
    const act = () => generateWaterSortProblem(rejectAllOptions);

    expect(act).toThrow(
      "Failed to generate a water sort problem within 2 attempts",
    );
  });
});

import { describe, expect, test } from "vitest";

import { generateWaterSortProblem, restoreWaterSortProblem } from "./generator";
import {
  isCompleteWaterSortBottle,
  isStandardWaterSortInitialState,
} from "./state";

describe("generateWaterSortProblem", () => {
  test("同じseedと生成条件から同じ問題と解析結果を再現すること", () => {
    const options = {
      seed: "water-sort-reproducible-seed",
      colorCount: 3,
    } as const;

    const first = generateWaterSortProblem(options);
    const second = generateWaterSortProblem(options);

    expect(second).toEqual(first);
  });

  test("標準初期形を満たし最初から完成した色入りボトルを含まないこと", () => {
    const problem = generateWaterSortProblem({
      seed: "water-sort-standard-state",
      colorCount: 4,
    });

    const standard = isStandardWaterSortInitialState(
      problem.initialState,
      problem.conditions.colorCount,
    );
    const hasCompletedBottle = problem.initialState.some(
      isCompleteWaterSortBottle,
    );

    expect(standard).toBe(true);
    expect(hasCompletedBottle).toBe(false);
    expect(problem.features.shortestMoveCount).toBe(
      problem.solutionMoves.length,
    );
    expect(problem.difficultyAnalysis.shortestMoveCount).toBe(
      problem.solutionMoves.length,
    );
  });

  test("生成器と独立した採用条件で候補を棄却できること", () => {
    let solvedCandidateCount = 0;

    const problem = generateWaterSortProblem({
      seed: "water-sort-acceptance-policy",
      colorCount: 3,
      acceptCandidate: () => {
        solvedCandidateCount += 1;
        return solvedCandidateCount >= 2;
      },
    });

    expect(solvedCandidateCount).toBe(2);
    expect(problem.generationAttempt).toBeGreaterThan(1);
  });

  test("保存した問題識別情報から採用条件に依存せず同じ問題を再現すること", () => {
    let solvedCandidateCount = 0;
    const problem = generateWaterSortProblem({
      seed: "water-sort-acceptance-policy",
      colorCount: 3,
      acceptCandidate: () => {
        solvedCandidateCount += 1;
        return solvedCandidateCount >= 2;
      },
    });
    const identity = {
      generatorVersion: problem.generatorVersion,
      seed: problem.seed,
      conditions: problem.conditions,
      generationAttempt: problem.generationAttempt,
    };

    const reproduced = restoreWaterSortProblem(identity);

    expect(reproduced).toEqual(problem);
  });

  test("採用条件を満たす候補が上限内に無ければ失敗を返すこと", () => {
    const act = () =>
      generateWaterSortProblem({
        seed: "water-sort-reject-all",
        colorCount: 3,
        maximumAttempts: 2,
        acceptCandidate: () => false,
      });

    expect(act).toThrow(
      "Failed to generate a water sort problem within 2 attempts",
    );
  });
});

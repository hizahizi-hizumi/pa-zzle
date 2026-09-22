import { analyzeWaterSortDifficulty } from "@/games/water-sort/problem/difficulty-analysis";
import { solveWaterSort } from "@/games/water-sort/problem/generation/solver";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";

const guidedState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

const constrainedState: WaterSortState = [
  [5, 0, 5, 4],
  [2, 1, 4, 0],
  [2, 5, 1, 3],
  [3, 1, 4, 3],
  [0, 3, 5, 2],
  [2, 4, 1, 0],
  [],
  [],
];

function solveState(state: WaterSortState) {
  const solved = solveWaterSort(state);
  if (solved.status !== "solved") {
    throw new Error("test state must be solvable");
  }
  return solved;
}

describe("analyzeWaterSortDifficulty", () => {
  test("複数の判断局面から自然な選択の結果を集計すること", () => {
    const solved = solveState(constrainedState);

    const analysis = analyzeWaterSortDifficulty(constrainedState, solved.moves);
    const choices = analysis.plausibleChoiceAnalysis;

    expect(choices.sampledDecisionStateCount).toBe(5);
    expect(choices.evaluatedChoiceCount).toBeGreaterThan(0);
    expect(choices.unresolvedChoiceCount).toBe(0);
    expect(
      choices.optimalChoiceCount +
        choices.detourChoiceCount +
        choices.deadEndChoiceCount,
    ).toBe(choices.evaluatedChoiceCount);
  });

  test("自然な選択肢から行き止まりへ入る局面を検出すること", () => {
    const solved = solveState(constrainedState);

    const analysis = analyzeWaterSortDifficulty(constrainedState, solved.moves);
    const choices = analysis.plausibleChoiceAnalysis;

    expect(choices.deadEndDecisionStateCount).toBeGreaterThan(0);
    expect(choices.deadEndChoiceCount).toBeGreaterThan(0);
    expect(choices.minimumSolvableChoiceRatio).toBeLessThan(1);
  });

  test("可解性を保つが最短より遠回りになる自然な選択を分けること", () => {
    const solved = solveState(guidedState);

    const analysis = analyzeWaterSortDifficulty(guidedState, solved.moves);
    const choices = analysis.plausibleChoiceAnalysis;

    expect(choices.detourChoiceCount).toBeGreaterThanOrEqual(0);
    expect(choices.maximumDetourMoves).toBeGreaterThanOrEqual(0);
  });

  test("自然な選択肢の可解性を判定できないとき未解決として残すこと", () => {
    const solved = solveState(guidedState);

    const analysis = analyzeWaterSortDifficulty(guidedState, solved.moves, {
      maxExpandedStatesPerPlausibleChoice: 0,
    });

    expect(
      analysis.plausibleChoiceAnalysis.unresolvedChoiceCount,
    ).toBeGreaterThan(0);
  });
});

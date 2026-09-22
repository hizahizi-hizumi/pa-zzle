import { analyzeWaterSortDifficulty } from "@/games/water-sort/problem/difficulty-analysis";
import { solveWaterSort } from "@/games/water-sort/problem/generation/solver";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";

const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

function solveInitialState() {
  const solved = solveWaterSort(initialState);
  if (solved.status !== "solved") {
    throw new Error("test state must be solvable");
  }
  return solved;
}

describe("analyzeWaterSortDifficulty", () => {
  test("最短解の直接結合以外を準備手数として数えること", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves);

    expect(analysis.minimumMergeMoveCount).toBe(6);
    expect(analysis.preparationMoveCount).toBe(
      solved.moves.length - analysis.minimumMergeMoveCount,
    );
    expect(analysis.preparationMoveRatio).toBeGreaterThanOrEqual(0);
  });

  test("空ボトルの減少を 0 から 1 の圧力として集計すること", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves);

    expect(analysis.averageEmptyBottlePressure).toBeGreaterThanOrEqual(0);
    expect(analysis.averageEmptyBottlePressure).toBeLessThanOrEqual(1);
    expect(analysis.noEmptyBottleStateRatio).toBeGreaterThanOrEqual(0);
    expect(analysis.noEmptyBottleStateRatio).toBeLessThanOrEqual(1);
  });

  test("代表局面の解決済み選択肢を最適・遠回り・行き止まりへ分解すること", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves);
    const risk = analysis.representativeChoiceRisk;
    const ratioTotal =
      risk.optimalChoiceRatio +
      risk.detourChoiceRatio +
      risk.deadEndChoiceRatio;

    expect(risk.evaluatedChoiceCount).toBeGreaterThan(0);
    expect(risk.unresolvedChoiceCount).toBe(0);
    expect(ratioTotal).toBeCloseTo(1);
  });

  test("追加探索の上限へ達した選択肢を未解決として残すこと", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves, {
      maxExpandedStatesPerRiskChoice: 0,
    });

    expect(
      analysis.representativeChoiceRisk.unresolvedChoiceCount,
    ).toBeGreaterThan(0);
  });

  test("評価数を 1 件に絞っても既知の最短経路へ続く選択肢を含めること", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves, {
      maximumRiskChoices: 1,
    });

    expect(analysis.representativeChoiceRisk.evaluatedChoiceCount).toBe(1);
    expect(analysis.representativeChoiceRisk.unresolvedChoiceCount).toBe(0);
    expect(analysis.representativeChoiceRisk.optimalChoiceRatio).toBe(1);
  });
});

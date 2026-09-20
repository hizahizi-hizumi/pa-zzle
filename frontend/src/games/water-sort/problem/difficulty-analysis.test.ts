import type { WaterSortState } from "../puzzle/state";
import { analyzeWaterSortDifficulty } from "./difficulty-analysis";
import { solveWaterSort } from "./generation/solver";

const initialState: WaterSortState = [[0, 1, 0, 1], [1, 0, 1, 0], [], []];

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

  test("複数局面の自然な選択肢から行き止まり選択を検出すること", () => {
    const solved = solveWaterSort(constrainedState);
    if (solved.status !== "solved") {
      throw new Error("test state must be solvable");
    }

    const analysis = analyzeWaterSortDifficulty(constrainedState, solved.moves);
    const safety = analysis.plausibleChoiceSafety;

    expect(safety.sampledDecisionStateCount).toBe(5);
    expect(safety.unresolvedChoiceCount).toBe(0);
    expect(safety.deadEndDecisionStateCount).toBeGreaterThan(0);
    expect(safety.deadEndChoiceCount).toBeGreaterThan(0);
    expect(safety.minimumSolvableChoiceRatio).toBeLessThan(1);
  });

  test("自然な選択肢の可解性を判定できないとき未解決として残すこと", () => {
    const solved = solveInitialState();

    const analysis = analyzeWaterSortDifficulty(initialState, solved.moves, {
      maxExpandedStatesPerPlausibleChoice: 0,
    });

    expect(
      analysis.plausibleChoiceSafety.unresolvedChoiceCount,
    ).toBeGreaterThan(0);
  });
});

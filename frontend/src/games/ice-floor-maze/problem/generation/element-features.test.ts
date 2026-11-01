// @vitest-environment node

import {
  classifyLooksReading,
  createElementContext,
  measureElementMetrics,
  summarizeSolutionMoves,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import {
  countShortestSolutions,
  measureDistancesToGoal,
  _private as stateSpace,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";

const { parseGenerationBoardRows } = stateSpace;

describe("見た目どおりの盤面に最短解が2本あり、番号の小さい手を優先した解だけが元の規則で通らない場合", () => {
  // 見た目どおり（もろい岩→岩）の最短解は 上左上左下右 と 下右上左上右 の2本。前者は元の規則では左上のもろい岩が崩れて通らない。
  const board = parseGenerationBoardRows([
    ".b...#",
    "....b#",
    "..#...",
    ".....#",
    "#.....",
    "......",
  ]);
  const start = 22;
  const goal = 9;
  const context = createElementContext(board, start);
  const looks = withGoal(context.looksFree!, goal);
  const looksToGoal = measureDistancesToGoal(looks);

  test("見た目どおりの盤面に最短解が2本あること", () => {
    const solutionCount = countShortestSolutions(
      looks,
      looksToGoal,
      looksToGoal[0]!,
    );

    expect(solutionCount).toBe(2);
  });

  test("通るほうの解の元の規則での手数を求め、静的な近道と読むこと", () => {
    const metrics = measureElementMetrics(context, goal)!;

    expect(metrics.looks).toEqual({ shortest: 6, passingMoveCount: 6 });
    expect(classifyLooksReading(metrics)).toBe("shortcut");
  });
});

describe("summarizeSolutionMoves", () => {
  describe("薄い氷を割って滑り、すぐ戻ってその水面で止まる問題の場合", () => {
    const board = parseGenerationBoardRows(["..c.."]);
    const metrics = measureElementMetrics(createElementContext(board, 0), 3)!;

    test("2手目が1手目で割った水面を使うと記録すること", () => {
      const { moves } = metrics;

      expect(moves.map((move) => move.changedCells)).toEqual([[2], []]);
      expect(moves[1]!.selfMadeUses).toEqual([
        { cell: 2, kind: "water", madeAt: 0, gap: 1 },
      ]);
    });

    test("割ってすぐ戻る手筋として数え、別の使い方には数えないこと", () => {
      const texture = summarizeSolutionMoves(metrics.moves, board.width);

      expect(texture).toMatchObject({
        shortSlideCount: 1,
        averageSlideLength: 2.5,
        selfMadeUseCount: 1,
        selfMadeMaximumGap: 1,
        quickReturnCount: 1,
        variedUseCount: 0,
        changedCellCount: 1,
      });
    });
  });
});

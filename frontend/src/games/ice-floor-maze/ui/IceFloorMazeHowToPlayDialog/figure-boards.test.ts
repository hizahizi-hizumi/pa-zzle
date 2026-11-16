import { findIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  doesIceFloorMazeSlidePassGoal,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import {
  applyIceFloorMazeHowToPlayDirections,
  goalFigure,
  trappedFigure,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";

describe("goalFigure", () => {
  const { board, start, goal, solution } = goalFigure;
  const origin = createIceFloorMazeInitialState(board, start);
  const graph = exploreIceFloorMazeStates(board, origin, { goal });
  const shortest =
    graph?.moveCounts[
      graph.states.findIndex(({ position }) => position === goal)
    ];
  const firstSlide = slideIceFloorMazePiece(board, origin, solution[0]!);

  test("手順が最短の手数でゴールに止まること", () => {
    const final = applyIceFloorMazeHowToPlayDirections(board, origin, solution);

    expect(final.position).toBe(goal);
    expect(solution).toHaveLength(shortest ?? -1);
  });

  test("最初の手でゴールを通り過ぎること", () => {
    const passed = doesIceFloorMazeSlidePassGoal(firstSlide, goal);

    expect(passed).toBe(true);
  });
});

describe("trappedFigure", () => {
  const { board, state, goal } = trappedFigure;

  test("本番の詰みの判定で、もうゴールに止まれない盤面であること", () => {
    const deadlock =
      goal === null ? null : findIceFloorMazeDeadlock(board, state, goal);

    expect(deadlock).not.toBeNull();
  });
});

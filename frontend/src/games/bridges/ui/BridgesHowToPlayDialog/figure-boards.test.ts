import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { goalFigure } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { BRIDGES_GOAL_VIEW_WIDTH } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-size";
import { createBoardView } from "@/games/bridges/ui/board/board-geometry";

describe("goalFigure", () => {
  const { edges } = getBridgesNetwork(goalFigure.board);
  const solved = edges.map((_, edge): BridgeCount => {
    const step = goalFigure.steps.find((candidate) => candidate.edge === edge);
    return step?.count ?? 0;
  });
  const beforeLast = solved.with(goalFigure.steps.at(-1)!.edge, 0);

  test("架ける順の辺は、どれも1度だけ出ること", () => {
    const stepEdges = goalFigure.steps.map(({ edge }) => edge);

    expect(new Set(stepEdges).size).toBe(stepEdges.length);
  });

  test("全部架けると、本番の判定で完成すること", () => {
    const result = isBridgesSolved(goalFigure.board, { bridges: solved });

    expect(result).toBe(true);
  });

  test("最後の橋を架ける前は、完成していないこと", () => {
    const result = isBridgesSolved(goalFigure.board, { bridges: beforeLast });

    expect(result).toBe(false);
  });

  test("架けていく途中で、多すぎの島が出ないこと", () => {
    const statuses = goalFigure.steps.flatMap((_, index) => {
      const partial = edges.map((__, edge): BridgeCount => {
        const step = goalFigure.steps
          .slice(0, index + 1)
          .find((candidate) => candidate.edge === edge);
        return step?.count ?? 0;
      });
      return listBridgesIslandStatuses(goalFigure.board, { bridges: partial });
    });

    expect(statuses).not.toContain("over");
  });

  test("絵の幅が、図のマスの大きさの式に書いた幅と同じであること", () => {
    const { width } = createBoardView(goalFigure.board);

    expect(width).toBeCloseTo(BRIDGES_GOAL_VIEW_WIDTH);
  });
});

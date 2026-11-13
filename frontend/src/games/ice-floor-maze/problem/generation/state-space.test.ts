import {
  _private,
  createElementRules,
  exploreStateSpace,
  fromGenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import { iceFloorMazeDirections } from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import { createProblemSeededRandom } from "@/games/problem-seed";

const { parseGenerationBoardRows } = _private;

describe("exploreStateSpace", () => {
  const random = createProblemSeededRandom("ice-floor-maze:state-space-floor");
  const boards = Array.from({ length: 60 }, (_, index) =>
    Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => {
        const roll = random();
        if (roll < 0.16) return "#";
        if (roll < 0.22) return index % 3 === 0 ? "b" : "m";
        if (roll < 0.3) return "c";
        if (roll < 0.36) return index % 3 === 1 ? "o" : "s";
        return ".";
      }).join(""),
    ),
  );

  test.each(boards.map((rows, index) => [index, rows] as const))(
    "要素のある盤面 %i で、遊ぶときの規則の状態のグラフと同じ順に同じ状態をたどり、同じ手で移ること",
    (_, rows) => {
      const board = parseGenerationBoardRows(rows);
      const playable = fromGenerationBoard(board);
      const start = board.cells.indexOf(0);
      const space = exploreStateSpace(createElementRules(board), start);
      const graph = exploreIceFloorMazeStates(
        playable,
        createIceFloorMazeInitialState(playable, start),
      );

      expect(space?.count).toBe(graph?.states.length);
      expect(Array.from(space!.positions)).toEqual(
        graph!.states.map((state) => state.position),
      );
      expect(Array.from(space!.targets)).toEqual(
        graph!.moves.flatMap((moves) =>
          iceFloorMazeDirections.map(
            (direction) =>
              moves.find((move) => move.direction === direction)
                ?.toStateIndex ?? -1,
          ),
        ),
      );
      expect(
        Array.from(space!.layoutIds, (layoutId) =>
          Array.from(space!.layouts.layouts[layoutId]!.blocks),
        ),
      ).toEqual(graph!.states.map((state) => [...state.blocks]));
    },
  );
});

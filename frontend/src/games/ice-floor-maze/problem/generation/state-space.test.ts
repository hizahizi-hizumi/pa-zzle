import {
  _private,
  CELL_BRITTLE,
  createElementRules,
  exploreStateSpace,
  findSlideEnd,
  fromGenerationBoard,
  maskAfterSlide,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import {
  applyIceFloorMazeSlide,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

const { parseGenerationBoardRows } = _private;

describe("findSlideEnd・maskAfterSlide", () => {
  const random = createProblemSeededRandom("ice-floor-maze:state-space-floor");
  const boards = Array.from({ length: 30 }, () =>
    Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => {
        const roll = random();
        if (roll < 0.16) return "#";
        if (roll < 0.22) return "b";
        if (roll < 0.3) return "c";
        if (roll < 0.38) return "o";
        return ".";
      }).join(""),
    ),
  );

  test.each(boards.map((rows, index) => [index, rows] as const))(
    "床と要素のある盤面 %i の到達できるどの状態でも、遊ぶときの規則と同じ位置で止まり同じ要素を変えること",
    (_, rows) => {
      const board = parseGenerationBoardRows(rows);
      const playable = fromGenerationBoard(board);
      const rules = createElementRules(board);
      const start = board.cells.indexOf(0);
      const space = exploreStateSpace(rules, start)!;

      const mismatches = Array.from({ length: space.count }, (_, state) => {
        const position = space.positions[state]!;
        const mask = space.masks[state]!;
        const cells = playable.cells.map(
          (cell, cellIndex): IceFloorMazeStateCell => {
            const element = rules.elementOf[cellIndex]!;
            if (element < 0 || ((mask >>> element) & 1) === 0) {
              return cell;
            }
            return rules.kinds[element] === CELL_BRITTLE ? "ice" : "water";
          },
        );
        return iceFloorMazeDirections.flatMap((direction, directionIndex) => {
          const slide = slideIceFloorMazePiece(
            playable,
            { position, cells },
            direction,
          );
          const end = findSlideEnd(rules, position, mask, directionIndex);
          const expected =
            slide.status === "slid"
              ? applyIceFloorMazeSlide({ position, cells }, slide)
              : null;
          const after =
            end === position
              ? null
              : maskAfterSlide(rules, position, end, mask, directionIndex);
          const changed =
            after === null
              ? null
              : Array.from(rules.elements).filter(
                  (_, element) => ((after >>> element) & 1) === 1,
                );
          const expectedChanged =
            expected === null
              ? null
              : Array.from(rules.elements).filter(
                  (cell) => expected.cells[cell] !== playable.cells[cell],
                );
          return (expected?.position ?? position) === end &&
            JSON.stringify(changed) === JSON.stringify(expectedChanged)
            ? []
            : [{ position, mask, direction }];
        });
      }).flat();

      expect(mismatches).toEqual([]);
    },
  );
});

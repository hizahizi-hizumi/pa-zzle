import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import {
  type IceFloorMazeDifficulty,
  type IceFloorMazeLevelCriteria,
  iceFloorMazeLevelCriteria,
} from "@/games/ice-floor-maze/difficulty";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import {
  _private,
  IceFloorMazeDifficultyPreview,
} from "@/games/ice-floor-maze/ui/IceFloorMazeDifficultyPreview";

const { previewStrip, createPreviewRoute } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

/** 盤面の幅が変わっても同じマスとして比べるため、マスを `x:y` で表す。 */
function readRoute(difficulty: IceFloorMazeDifficulty) {
  const route = createPreviewRoute(difficulty);
  const { board } = route;
  function toPoint(cellIndex: number): string {
    const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
    return `${x}:${y}`;
  }
  const rockCells = board.cells.flatMap((cell, cellIndex) =>
    cell === "rock" || cell === "brittle-rock" ? [cellIndex] : [],
  );
  return {
    ...route,
    rockPoints: rockCells.map(toPoint),
    stopPoints: route.slides.map(({ to }) => toPoint(to)),
    rows: [route.start, ...route.slides.map(({ to }) => to), ...rockCells].map(
      (cellIndex) => getIceFloorMazeCellPosition(board, cellIndex).y,
    ),
  };
}

/** 開始位置から向きの順に滑らせ、止まった位置を並べる。動けない向きでは止まった位置を足さない。 */
function replayStops(
  board: IceFloorMazeBoard,
  start: number,
  directions: readonly IceFloorMazeDirection[],
): number[] {
  const stops: number[] = [];
  let state = createIceFloorMazeInitialState(board, start);
  for (const direction of directions) {
    const slide = slideIceFloorMazePiece(board, state, direction);
    if (slide.status === "slid") {
      stops.push(slide.to);
      state = applyIceFloorMazeSlide(state, slide);
    }
  }
  return stops;
}

describe("createPreviewRoute", () => {
  const adjacentLevels = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const satisfies readonly (readonly [
    IceFloorMazeDifficulty,
    IceFloorMazeDifficulty,
  ])[];

  test.each(difficultyIds)(
    "レベル %s の帯は、そのレベルで出す最も広い盤面の形で描くこと",
    (difficulty) => {
      const { board } = readRoute(difficulty);

      expect({ width: board.width, height: board.height }).toEqual(
        iceFloorMazeLevelCriteria[difficulty].largestBoardShape,
      );
    },
  );

  test.each(difficultyIds)(
    "レベル %s の道筋は、ルールどおりの滑りを決めた数だけ繋ぎ、止まった位置にゴールを置くこと",
    (difficulty) => {
      const { board, start, goal, slides } = readRoute(difficulty);

      const replayedStops = replayStops(
        board,
        start,
        slides.map(({ direction }) => direction),
      );

      expect(slides).toHaveLength(previewStrip.levels[difficulty].slideCount);
      expect(replayedStops).toEqual(slides.map(({ to }) => to));
      expect(goal).toBe(replayedStops.at(-1));
    },
  );

  test.each(difficultyIds)(
    "レベル %s の開始位置・止まる位置・岩は帯の行の中にあること",
    (difficulty) => {
      const { rows } = readRoute(difficulty);

      expect(Math.max(...rows)).toBeLessThan(previewStrip.rowCount);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の岩ともろい岩はどれも道筋のどこかの止まる位置のすぐ先にあること",
    (difficulty) => {
      const { board, slides } = readRoute(difficulty);

      const rockCells = board.cells.flatMap((cell, cellIndex) =>
        cell === "rock" || cell === "brittle-rock" ? [cellIndex] : [],
      );
      const cellsJustBeyondStops = slides.map(({ direction, to }) =>
        getIceFloorMazeNeighbor(board, to, direction),
      );

      expect(cellsJustBeyondStops).toEqual(expect.arrayContaining(rockCells));
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の止め役と道筋を、レベル %s が同じマスにすべて含むこと",
    (lower, upper) => {
      const lowerRoute = readRoute(lower);
      const upperRoute = readRoute(upper);

      expect(upperRoute.rockPoints).toEqual(
        expect.arrayContaining(lowerRoute.rockPoints),
      );
      expect(
        upperRoute.stopPoints.slice(0, lowerRoute.stopPoints.length),
      ).toEqual(lowerRoute.stopPoints);
      expect(upperRoute.slides.length).toBeGreaterThanOrEqual(
        lowerRoute.slides.length,
      );
    },
  );

  test.each(difficultyIds)(
    "レベル %s の帯に置く要素の種類が、そのレベルの挑戦の型が置く要素の種類に含まれること",
    (difficulty) => {
      const { board } = readRoute(difficulty);
      const criteria: IceFloorMazeLevelCriteria =
        iceFloorMazeLevelCriteria[difficulty];

      const drawnKinds = new Set(
        board.cells.filter(
          (cell) => cell === "brittle-rock" || cell === "thin-ice",
        ),
      );
      const levelKinds = new Set(
        criteria.kind === "tactics"
          ? []
          : criteria.patterns.flatMap(({ composition }) =>
              composition === "mixed"
                ? ["brittle-rock", "thin-ice"]
                : [composition],
            ),
      );

      expect(levelKinds.isSupersetOf(drawnKinds)).toBe(true);
      expect(drawnKinds.size > 0).toBe(criteria.kind === "elements");
    },
  );
});

describe("IceFloorMazeDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s の道筋の滑りごとの跡と、駒とゴールを1つずつ描くこと",
    (difficulty) => {
      const { container } = render(
        <IceFloorMazeDifficultyPreview difficulty={difficulty} />,
      );

      expect(container.querySelectorAll("[data-trail]")).toHaveLength(
        previewStrip.levels[difficulty].slideCount,
      );
      expect(container.querySelectorAll("[data-goal]")).toHaveLength(1);
    },
  );
});

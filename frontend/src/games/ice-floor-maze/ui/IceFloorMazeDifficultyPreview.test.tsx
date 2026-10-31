import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import {
  type IceFloorMazeDifficulty,
  iceFloorMazeLevelCombinations,
} from "@/games/ice-floor-maze/difficulty";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
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
    cell === "rock" ? [cellIndex] : [],
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
  let position = start;
  for (const direction of directions) {
    const slide = slideIceFloorMazePiece(board, position, direction);
    if (slide.status === "slid") {
      stops.push(slide.to);
      position = slide.to;
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
      const widest =
        iceFloorMazeLevelCombinations[difficulty].boardShapes.at(-1);

      expect({ width: board.width, height: board.height }).toEqual(widest);
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

      expect(slides).toHaveLength(previewStrip.slideCounts[difficulty]);
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
    "レベル %s の岩はどれも道筋のどこかの止まる位置のすぐ先にあること",
    (difficulty) => {
      const { board, slides } = readRoute(difficulty);

      const rockCells = board.cells.flatMap((cell, cellIndex) =>
        cell === "rock" ? [cellIndex] : [],
      );
      const cellsJustBeyondStops = slides.map(({ direction, to }) =>
        getIceFloorMazeNeighbor(board, to, direction),
      );

      expect(cellsJustBeyondStops).toEqual(expect.arrayContaining(rockCells));
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の岩と道筋を、レベル %s が同じマスにすべて含むこと",
    (lower, upper) => {
      const lowerRoute = readRoute(lower);
      const upperRoute = readRoute(upper);

      expect(upperRoute.rockPoints).toEqual(
        expect.arrayContaining(lowerRoute.rockPoints),
      );
      expect(
        upperRoute.stopPoints.slice(0, lowerRoute.stopPoints.length),
      ).toEqual(lowerRoute.stopPoints);
      expect(upperRoute.slides.length).toBeGreaterThan(
        lowerRoute.slides.length,
      );
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
        previewStrip.slideCounts[difficulty],
      );
      expect(container.querySelectorAll("[data-goal]")).toHaveLength(1);
    },
  );
});

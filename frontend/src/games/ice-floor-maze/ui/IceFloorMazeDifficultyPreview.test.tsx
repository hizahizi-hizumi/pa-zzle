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
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import {
  _private,
  IceFloorMazeDifficultyPreview,
} from "@/games/ice-floor-maze/ui/IceFloorMazeDifficultyPreview";

const { createPreviewRoute } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

afterEach(cleanup);

/** 道筋を滑らせ直し、滑りごとに通ったマス・止めたマス・崩れたもろい岩・割れた薄い氷を並べる。 */
function replayRoute(difficulty: IceFloorMazeDifficulty) {
  const route = createPreviewRoute(difficulty);
  const { board, start } = route;
  let state = createIceFloorMazeInitialState(board, start);
  const slides = route.slides.map(({ direction }) => {
    const slide = slideIceFloorMazePiece(board, state, direction);
    if (slide.status === "blocked") {
      throw new Error("preview slide is blocked");
    }
    const stopper = getIceFloorMazeNeighbor(board, slide.to, direction);
    const replayed = {
      direction,
      from: slide.from,
      to: slide.to,
      path: slide.path,
      stopper,
      stopperCell: stopper === null ? "wall" : state.cells[stopper],
      crumbledRock: slide.crumbledRock,
      crackedIce: slide.crackedIce,
    };
    state = applyIceFloorMazeSlide(state, slide);
    return replayed;
  });
  return { ...route, replayed: slides, finalPosition: state.position };
}

function listCells(board: IceFloorMazeBoard, cell: string): number[] {
  return board.cells.flatMap((boardCell, cellIndex) =>
    boardCell === cell ? [cellIndex] : [],
  );
}

/** 開始位置からゴールで止まるまでの最少手数と、その手数でゴールで止まる滑りの並びの数。 */
function countShortestRoutes(
  board: IceFloorMazeBoard,
  start: number,
  goal: number,
) {
  const graph = exploreIceFloorMazeStates(
    board,
    createIceFloorMazeInitialState(board, start),
    { goal },
  );
  if (!graph) {
    throw new Error("preview board exceeds the state limit");
  }
  const routeCounts = graph.states.map((_, order) => (order === 0 ? 1 : 0));
  graph.moves.forEach((moves, order) => {
    for (const { to } of moves) {
      if (graph.moveCounts[to] === graph.moveCounts[order]! + 1) {
        routeCounts[to]! += routeCounts[order]!;
      }
    }
  });
  const goalStates = graph.states.flatMap(({ position }, order) =>
    position === goal ? [order] : [],
  );
  const moveCount = Math.min(
    ...goalStates.map((order) => graph.moveCounts[order]!),
  );
  const routeCount = goalStates
    .filter((order) => graph.moveCounts[order] === moveCount)
    .reduce((sum, order) => sum + routeCounts[order]!, 0);
  return { moveCount, routeCount };
}

/** 開始位置から見てゴールの側と逆の向き（開始位置の側へ戻る向き）か。 */
function headsTowardStart(
  board: IceFloorMazeBoard,
  start: number,
  goal: number,
  direction: (typeof iceFloorMazeDirections)[number],
): boolean {
  const startPoint = getIceFloorMazeCellPosition(board, start);
  const goalPoint = getIceFloorMazeCellPosition(board, goal);
  const step = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  }[direction];
  return (
    step.x * (startPoint.x - goalPoint.x) +
      step.y * (startPoint.y - goalPoint.y) >
    0
  );
}

describe("createPreviewRoute", () => {
  test.each(difficultyIds)(
    "レベル %s の道筋は、ルールどおりの滑りで開始位置からゴールに止まり、図の盤面のただ1つの最短の道筋であること",
    (difficulty) => {
      const { board, start, goal, slides, finalPosition } =
        replayRoute(difficulty);

      const shortest = countShortestRoutes(board, start, goal);

      expect(finalPosition).toBe(goal);
      expect(shortest).toEqual({ moveCount: slides.length, routeCount: 1 });
    },
  );

  test.each(difficultyIds)(
    "レベル %s の道筋は、同じ向きへ続けて滑らないこと",
    (difficulty) => {
      const { slides } = replayRoute(difficulty);

      const repeated = slides.filter(
        ({ direction }, index) => slides[index - 1]?.direction === direction,
      );

      expect(repeated).toEqual([]);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の岩はどれも道筋の通るマスに接すること",
    (difficulty) => {
      const { board, start, replayed } = replayRoute(difficulty);

      const routeCells = new Set([
        start,
        ...replayed.flatMap(({ path }) => path),
      ]);
      const rocksAwayFromRoute = listCells(board, "rock").filter(
        (rock) =>
          !iceFloorMazeDirections.some((direction) => {
            const neighbor = getIceFloorMazeNeighbor(board, rock, direction);
            return neighbor !== null && routeCells.has(neighbor);
          }),
      );

      expect(rocksAwayFromRoute).toEqual([]);
    },
  );

  test("どのレベルも同じ大きさの盤面で、開始位置とゴールが同じであること", () => {
    const routes = difficultyIds.map((difficulty) => {
      const { board, start, goal } = createPreviewRoute(difficulty);
      return { width: board.width, height: board.height, start, goal };
    });

    expect(new Set(routes.map((route) => JSON.stringify(route))).size).toBe(1);
  });

  test("最後の滑りの止め役が、どのレベルでもゴールの先の岩であること", () => {
    const lastStoppers = difficultyIds.map(
      (difficulty) => replayRoute(difficulty).replayed.at(-1)?.stopperCell,
    );

    expect(lastStoppers).toEqual(difficultyIds.map(() => "rock"));
  });

  describe("レベル1", () => {
    const { board, start, goal, replayed } = replayRoute("1");

    test("ゴールを通り過ぎず、最後の滑りが開始位置の側へ戻らないこと", () => {
      const passesGoal = replayed.some(
        ({ path, to }) => path.slice(0, -1).includes(goal) && to !== goal,
      );
      const lastHeadsTowardStart = headsTowardStart(
        board,
        start,
        goal,
        replayed.at(-1)!.direction,
      );

      expect({ passesGoal, lastHeadsTowardStart }).toEqual({
        passesGoal: false,
        lastHeadsTowardStart: false,
      });
    });
  });

  describe("レベル2", () => {
    const { board, start, goal, replayed } = replayRoute("2");

    test("途中でゴールを通り過ぎ、最後の滑りが開始位置の側へ戻ってゴールに止まること", () => {
      const passesGoal = replayed
        .slice(0, -1)
        .some(({ path }) => path.includes(goal));
      const lastHeadsTowardStart = headsTowardStart(
        board,
        start,
        goal,
        replayed.at(-1)!.direction,
      );

      expect({ passesGoal, lastHeadsTowardStart }).toEqual({
        passesGoal: true,
        lastHeadsTowardStart: true,
      });
    });
  });

  const levelsWithBrittleRocks = ["3", "4", "5"] as const;
  const levelsWithThinIce = ["4", "5"] as const;

  test.each(levelsWithBrittleRocks)(
    "レベル %s のもろい岩はどれも、道筋で一度滑りを止めて崩れ、その跡を後の滑りが通り抜けること",
    (difficulty) => {
      const { board, replayed } = replayRoute(difficulty);

      const usedBrittleRocks = listCells(board, "brittle-rock").filter(
        (brittleRock) => {
          const crumbledAt = replayed.findIndex(
            ({ crumbledRock }) => crumbledRock === brittleRock,
          );
          return (
            crumbledAt >= 0 &&
            replayed
              .slice(crumbledAt + 1)
              .some(({ path }) => path.includes(brittleRock))
          );
        },
      );

      expect(usedBrittleRocks).toEqual(listCells(board, "brittle-rock"));
      expect(usedBrittleRocks.length).toBeGreaterThan(0);
    },
  );

  test.each(levelsWithThinIce)(
    "レベル %s の薄い氷はどれも、道筋で割れ、その水面で後の滑りが止まること",
    (difficulty) => {
      const { board, replayed } = replayRoute(difficulty);

      const usedThinIce = listCells(board, "thin-ice").filter((thinIce) => {
        const crackedAt = replayed.findIndex(({ crackedIce }) =>
          crackedIce.includes(thinIce),
        );
        return (
          crackedAt >= 0 &&
          replayed
            .slice(crackedAt + 1)
            .some(
              ({ stopper, stopperCell }) =>
                stopper === thinIce && stopperCell === "water",
            )
        );
      });

      expect(usedThinIce).toEqual(listCells(board, "thin-ice"));
      expect(usedThinIce.length).toBeGreaterThan(0);
    },
  );

  test("レベル5 は、もろい岩と薄い氷をレベル4 より多く置くこと", () => {
    const [level4, level5] = (["4", "5"] as const).map((difficulty) => {
      const { board } = createPreviewRoute(difficulty);
      return {
        brittleRocks: listCells(board, "brittle-rock").length,
        thinIce: listCells(board, "thin-ice").length,
      };
    });

    expect(level5!.brittleRocks).toBeGreaterThan(level4!.brittleRocks);
    expect(level5!.thinIce).toBeGreaterThan(level4!.thinIce);
  });

  const adjacentLevels = [
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const satisfies readonly (readonly [
    IceFloorMazeDifficulty,
    IceFloorMazeDifficulty,
  ])[];

  test.each(adjacentLevels)(
    "レベル %s の岩と要素を、レベル %s が同じマスにすべて残すこと",
    (lower, upper) => {
      const lowerBoard = createPreviewRoute(lower).board;
      const upperBoard = createPreviewRoute(upper).board;

      const lowerPlacements = lowerBoard.cells.flatMap((cell, cellIndex) =>
        cell === "ice" ? [] : [`${cellIndex}:${cell}`],
      );
      const upperPlacements = upperBoard.cells.flatMap((cell, cellIndex) =>
        cell === "ice" ? [] : [`${cellIndex}:${cell}`],
      );

      expect(upperPlacements).toEqual(expect.arrayContaining(lowerPlacements));
    },
  );

  test.each(difficultyIds)(
    "レベル %s の盤面に置く要素の種類が、そのレベルの挑戦の型が置く要素の種類に含まれること",
    (difficulty) => {
      const { board } = createPreviewRoute(difficulty);
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
    "レベル %s の道筋の滑りごとの跡と、盤面のもろい岩・薄い氷と、駒とゴールを1つずつ描くこと",
    (difficulty) => {
      const { board, slides } = createPreviewRoute(difficulty);

      const { container } = render(
        <IceFloorMazeDifficultyPreview difficulty={difficulty} />,
      );

      expect({
        trails: container.querySelectorAll("[data-trail]").length,
        brittleRocks: container.querySelectorAll("[data-brittle-rock-cell]")
          .length,
        thinIce: container.querySelectorAll("[data-thin-ice-cell]").length,
        goals: container.querySelectorAll("[data-goal]").length,
      }).toEqual({
        trails: slides.length,
        brittleRocks: listCells(board, "brittle-rock").length,
        thinIce: listCells(board, "thin-ice").length,
        goals: 1,
      });
    },
  );
});

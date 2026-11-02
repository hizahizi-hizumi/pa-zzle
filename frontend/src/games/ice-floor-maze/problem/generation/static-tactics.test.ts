import {
  _private,
  DIRECTION_COUNT,
  fromGenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import {
  createStaticBoardGraph,
  createStaticFloor,
  createStaticStopper,
  measureStaticFloors,
} from "@/games/ice-floor-maze/problem/generation/static-tactics";
import {
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

const { parseGenerationBoardRows } = _private;

function createGraph(rows: readonly string[], start: number) {
  const board = parseGenerationBoardRows(rows);
  return createStaticBoardGraph(
    board.width,
    board.height,
    createStaticStopper(board),
    start,
    null,
    createStaticFloor(board),
  );
}

describe("createStaticBoardGraph", () => {
  const random = createProblemSeededRandom("ice-floor-maze:static-floor");
  const boards = Array.from({ length: 40 }, () =>
    Array.from({ length: 7 }, () =>
      Array.from({ length: 6 }, () => {
        const roll = random();
        return roll < 0.2 ? "#" : roll < 0.32 ? "o" : ".";
      }).join(""),
    ),
  );

  test.each(boards.map((rows, index) => [index, rows] as const))(
    "床のある盤面 %i で、停止点からの滑りが遊ぶときの規則と一致すること",
    (_, rows) => {
      const board = parseGenerationBoardRows(rows);
      const playable = fromGenerationBoard(board);
      const start = board.cells.indexOf(0);
      const graph = createGraph(rows, start);

      for (const stop of graph.order) {
        iceFloorMazeDirections.forEach((direction, directionIndex) => {
          const slide = slideIceFloorMazePiece(
            playable,
            createIceFloorMazeInitialState(playable, stop),
            direction,
          );
          const end = graph.ends[stop * DIRECTION_COUNT + directionIndex];

          expect(end).toBe(slide.status === "slid" ? slide.to : -1);
        });
      }
    },
  );
});

describe("measureStaticFloors", () => {
  describe("止まる床・おとりの床・効かない床が1つずつある場合", () => {
    // 0  1  #  3  o  #
    // 6  7  #  9  10 S
    // o  13 14 #  #  17
    // G  o  #  21 #  23
    // 24 25 26 27 28 29
    // 30 31 #  33 #  #
    // 最短の道筋は 下・左・下・右・上・左。5手目の上は床 19 に入って止まる（氷なら 13・7・1 と上まで滑る）。
    // 1手目の候補の左は床 12 に入って止まり、最短の道筋から外れる（おとり）。床 4 は上の外壁の手前で、氷でも同じに止まる。
    const rows = ["..#.o#", "..#...", "o..##.", ".o#.#.", "......", "..#.##"];
    const graph = createGraph(rows, 11);

    test("床の役割を数えること", () => {
      const floors = measureStaticFloors(graph, 11, 18, 3);

      expect(floors).toMatchObject({
        floorCount: 3,
        usedFloorCount: 1,
        floorStopCount: 1,
        decoyFloorCount: 1,
        irrelevantFloorCount: 1,
        repeatCount: 0,
        tapCount: 0,
      });
    });
  });

  describe("床が滑る向きに隣り合う場合", () => {
    // S  1  o  o  G  #
    // 右へ滑るたびに、床 2・床 3 で1マスずつ止まる。
    const graph = createGraph(["..oo.#"], 0);

    test("同じ向きが続く最短解と、1マスだけ進む同じ向きの手（連打）を数えること", () => {
      const floors = measureStaticFloors(graph, 0, 4, 3);

      expect(floors).toMatchObject({ repeatCount: 2, tapCount: 2 });
    });
  });

  describe("床の無い盤面の場合", () => {
    const graph = createGraph(["....#", ".#...", "....."], 0);

    test("床の働きを0とすること", () => {
      const floors = measureStaticFloors(graph, 0, 3, 3);

      expect(floors).toEqual({
        floorCount: 0,
        usedFloorCount: 0,
        floorStopCount: 0,
        decoyFloorCount: 0,
        irrelevantFloorCount: 0,
        repeatCount: 0,
        nearRepeatCount: 0,
        tapCount: 0,
        splitReadingDepth: 0,
      });
    });
  });
});

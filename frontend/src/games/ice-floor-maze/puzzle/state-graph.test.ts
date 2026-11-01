// @vitest-environment node

import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";
import {
  exploreIceFloorMazeStates,
  type IceFloorMazeStateGraph,
} from "@/games/ice-floor-maze/puzzle/state-graph";

/** ゴールで止まった状態への最短の手順のうち、各手で上・右・下・左の順に先の向きを選んだもの。 */
function findFirstShortestSolution(
  graph: IceFloorMazeStateGraph,
  goal: number,
): IceFloorMazeDirection[] {
  const predecessors = graph.states.map((): number[] => []);
  for (const [from, stateMoves] of graph.moves.entries()) {
    for (const { to } of stateMoves) {
      predecessors[to]!.push(from);
    }
  }
  const movesToGoal = graph.states.map(({ position }) =>
    position === goal ? 0 : Number.POSITIVE_INFINITY,
  );
  const pending = movesToGoal.flatMap((count, index) =>
    count === 0 ? [index] : [],
  );
  for (let order = 0; order < pending.length; order += 1) {
    const current = pending[order]!;
    for (const predecessor of predecessors[current]!) {
      if (movesToGoal[predecessor] === Number.POSITIVE_INFINITY) {
        movesToGoal[predecessor] = movesToGoal[current]! + 1;
        pending.push(predecessor);
      }
    }
  }

  const solution: IceFloorMazeDirection[] = [];
  let current = 0;
  while (movesToGoal[current]! > 0) {
    const next = graph.moves[current]!.find(
      ({ to }) => movesToGoal[to] === movesToGoal[current]! - 1,
    )!;
    solution.push(next.direction);
    current = next.to;
  }
  return solution;
}

/** 開始状態からゴールで止まるまでの最短の手順の数。 */
function countShortestSolutions(
  graph: IceFloorMazeStateGraph,
  goal: number,
): number {
  const ways = graph.states.map((_, index) => (index === 0 ? 1 : 0));
  for (const [from, stateMoves] of graph.moves.entries()) {
    for (const { to } of stateMoves) {
      if (graph.moveCounts[to] === graph.moveCounts[from]! + 1) {
        ways[to]! += ways[from]!;
      }
    }
  }
  const goalStates = graph.states.flatMap(({ position }, index) =>
    position === goal ? [index] : [],
  );
  const shortest = Math.min(
    ...goalStates.map((index) => graph.moveCounts[index]!),
  );
  return goalStates
    .filter((index) => graph.moveCounts[index] === shortest)
    .reduce((total, index) => total + ways[index]!, 0);
}

const notationByCell = {
  ice: ".",
  rock: "#",
  "brittle-rock": "b",
  "thin-ice": "c",
  outside: "x",
  water: "w",
} as const satisfies Record<IceFloorMazeStateCell, string>;

const stepByDirection = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
} as const satisfies Record<IceFloorMazeDirection, readonly [number, number]>;

/**
 * 研究用 Python の slow_moves と同じ、盤面の文字を1マスずつ書き換える独立の実装。
 * 崩れたもろい岩は `.`、割れた薄い氷は `w`。動けなければ `null`。
 */
function slideOneCellAtATime(
  board: IceFloorMazeBoard,
  grid: readonly string[],
  position: number,
  direction: IceFloorMazeDirection,
): { position: number; grid: string[] } | null {
  const [dx, dy] = stepByDirection[direction];
  const { width, height } = board;
  function cellAt(x: number, y: number): number | null {
    return x >= 0 && x < width && y >= 0 && y < height ? y * width + x : null;
  }

  const path = [position];
  while (true) {
    const last = path.at(-1)!;
    const next = cellAt((last % width) + dx, Math.floor(last / width) + dy);
    if (next === null || "#bxw".includes(grid[next]!)) {
      break;
    }
    path.push(next);
  }
  if (path.length === 1) {
    return null;
  }

  const end = path.at(-1)!;
  const nextGrid = [...grid];
  const beyond = cellAt((end % width) + dx, Math.floor(end / width) + dy);
  if (beyond !== null && nextGrid[beyond] === "b") {
    nextGrid[beyond] = ".";
  }
  for (const cellIndex of path.slice(0, -1)) {
    if (nextGrid[cellIndex] === "c") {
      nextGrid[cellIndex] = "w";
    }
  }
  return { position: end, grid: nextGrid };
}

describe("exploreIceFloorMazeStates", () => {
  // 0 c 2 3 b 5
  // 6 7 8 9 # 11
  const board = parseIceFloorMazeBoard([".c..b.", "....#."]);
  const origin = createIceFloorMazeInitialState(board, 0);

  test("起点を先頭に、状態を起点からの最少手数の昇順に並べること", () => {
    const graph = exploreIceFloorMazeStates(board, origin)!;

    expect(graph.states[0]).toBe(origin);
    expect(graph.moveCounts).toEqual(
      [...graph.moveCounts].sort((left, right) => left - right),
    );
  });

  test("駒の位置が同じでも、変わった要素の違う状態を別の状態として数えること", () => {
    const graph = exploreIceFloorMazeStates(board, origin)!;

    const statesAtOrigin = graph.states.filter(
      ({ position }) => position === 0,
    );

    expect(statesAtOrigin.length).toBeGreaterThan(1);
  });

  test("同じ状態へ別の手順で移っても1つの状態として数えること", () => {
    const graph = exploreIceFloorMazeStates(board, origin)!;

    const keys = graph.states.map(
      ({ position, cells }) => `${position}:${cells.join(",")}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  test("ゴールを渡すと、ゴールで止まった状態から先をたどらないこと", () => {
    const graph = exploreIceFloorMazeStates(board, origin, { goal: 3 })!;

    const goalMoves = graph.states.flatMap(({ position }, index) =>
      position === 3 ? [graph.moves[index]] : [],
    );

    expect(goalMoves.length).toBeGreaterThan(0);
    expect(goalMoves.every((moves) => moves?.length === 0)).toBe(true);
  });

  describe("状態の数が上限を超える場合", () => {
    const limit = 3;

    test("null を返すこと", () => {
      const graph = exploreIceFloorMazeStates(board, origin, { limit });

      expect(graph).toBeNull();
    });
  });

  describe("要素の数が状態を数で表せる数を超える場合", () => {
    // 31個のもろい岩。
    const crowdedBoard = parseIceFloorMazeBoard([
      ".bbbbb",
      "bbbbbb",
      "bbbbbb",
      "bbbbbb",
      "bbbbbb",
      "bb....",
    ]);

    test("状態をたどらないこと", () => {
      function act() {
        exploreIceFloorMazeStates(
          crowdedBoard,
          createIceFloorMazeInitialState(crowdedBoard, 0),
        );
      }

      expect(act).toThrow(RangeError);
    });
  });

  describe("研究用 Python の生成 v4 の試遊候補の場合", () => {
    // docs/パズル/導入調査/氷の床迷路/作り直し資料/試遊ページv4.html の9問。期待値は
    // scripts/research/ice_floor_hardest_generation_experiment.py の explore（ゴールつき）の状態の数と、
    // reverse_layers・canonical_solution の最短解。
    const candidates = [
      {
        id: "w01",
        rows: [
          ".....#..",
          "..##b...",
          "..##..b#",
          "#...b..#",
          "#b.....b",
          "###.#..#",
          ".....b.#",
          ".#....b#",
        ],
        start: 38,
        goal: 14,
        stateCount: 928,
        solution: [
          "left",
          "up",
          "right",
          "down",
          "left",
          "up",
          "right",
          "down",
          "right",
          "up",
          "right",
          "up",
          "left",
          "down",
        ],
      },
      {
        id: "w02",
        rows: [
          "##.....#",
          "....c...",
          ".c......",
          "#....#.c",
          "#c.cc.#.",
          ".c....##",
          "##......",
          "#..#.###",
        ],
        start: 20,
        goal: 42,
        stateCount: 327,
        solution: [
          "right",
          "up",
          "left",
          "right",
          "down",
          "up",
          "right",
          "up",
          "left",
          "up",
          "down",
          "left",
          "down",
          "right",
          "left",
        ],
      },
      {
        id: "w03",
        rows: [
          ".#.......#",
          "..c.###c#.",
          ".b..###...",
          "#......#.#",
          ".#.......c",
          "cc..c##...",
          "..#.....#.",
          "...#..#.#.",
          "#.....#.##",
          "##........",
          "...#.#....",
          ".###....b#",
        ],
        start: 94,
        goal: 11,
        stateCount: 1633,
        solution: [
          "down",
          "right",
          "up",
          "right",
          "left",
          "right",
          "up",
          "left",
          "up",
          "left",
          "down",
          "up",
          "right",
          "left",
          "down",
          "right",
          "up",
          "left",
          "up",
        ],
      },
      {
        id: "w04",
        rows: [
          ".##....##.",
          "........#.",
          ".#...#....",
          ".#.....c..",
          "..#c.#....",
          "#.#......c",
          "#....c....",
          "#.##c#.c..",
          "x#...###..",
          "#.....c...",
        ],
        start: 39,
        goal: 67,
        stateCount: 581,
        solution: [
          "down",
          "up",
          "left",
          "right",
          "up",
          "left",
          "down",
          "right",
          "up",
          "left",
          "down",
          "left",
          "up",
          "right",
          "down",
          "up",
          "down",
        ],
      },
      {
        id: "w05",
        rows: [
          "x#b......#",
          "#...#.....",
          "#c.##.c#..",
          "........#.",
          "........c#",
          "#........#",
          "#..b#.....",
          "x##.b..bc.",
          "x#...##.#.",
          "x#..##...#",
        ],
        start: 66,
        goal: 12,
        stateCount: 3173,
        solution: [
          "up",
          "down",
          "left",
          "down",
          "right",
          "up",
          "left",
          "down",
          "right",
          "down",
          "up",
          "left",
          "down",
          "right",
          "up",
        ],
      },
      {
        id: "w06",
        rows: [
          "...###.#.#",
          "..#....#..",
          "#.###.....",
          "...b....#.",
          "#...##..#.",
          "....#...##",
          "..bb#..#.#",
          "...#.....b",
          "...#.##..#",
          ".b..#.#.#.",
          "#b....#...",
          "x#b#.....#",
        ],
        start: 36,
        goal: 93,
        stateCount: 365,
        solution: [
          "down",
          "right",
          "down",
          "left",
          "down",
          "left",
          "up",
          "left",
          "up",
          "left",
          "up",
          "right",
          "up",
          "left",
          "down",
          "left",
          "down",
          "right",
        ],
      },
      {
        id: "w07",
        rows: [
          ".###......",
          "....##....",
          ".#...###.#",
          "#........c",
          "..##.####.",
          "......c...",
          ".c..c...#c",
          "......c...",
          "#.##...#..",
          "...c.###.#",
          "##.....#..",
          "....###...",
        ],
        start: 72,
        goal: 73,
        stateCount: 1913,
        solution: [
          "up",
          "right",
          "up",
          "left",
          "down",
          "up",
          "left",
          "up",
          "right",
          "down",
          "right",
          "down",
          "right",
          "up",
          "left",
          "right",
          "down",
        ],
      },
      {
        id: "w08",
        rows: [
          "...#...#",
          ".cc.....",
          ".c..#.#.",
          ".#.##..c",
          ".##x##c.",
          "b..#....",
          ".b...#..",
          "....b...",
        ],
        start: 16,
        goal: 57,
        stateCount: 531,
        solution: [
          "right",
          "up",
          "right",
          "down",
          "up",
          "left",
          "down",
          "up",
          "left",
          "down",
          "left",
          "up",
          "left",
          "down",
        ],
      },
      {
        id: "w09",
        rows: [
          "..#..b##",
          "b......b",
          "...b.###",
          "......b.",
          "b#.###..",
          "#.....b.",
          "..##...#",
          ".#...##x",
        ],
        start: 11,
        goal: 39,
        stateCount: 348,
        solution: [
          "up",
          "right",
          "down",
          "left",
          "up",
          "right",
          "down",
          "right",
          "down",
          "right",
          "up",
          "right",
        ],
      },
    ].map((candidate) => ({
      ...candidate,
      board: parseIceFloorMazeBoard(candidate.rows),
    }));

    test.each(candidates)(
      "$id の状態の数・最短解・最短解の数が Python と一致すること",
      ({ board: candidateBoard, start, goal, stateCount, solution }) => {
        const graph = exploreIceFloorMazeStates(
          candidateBoard,
          createIceFloorMazeInitialState(candidateBoard, start),
          { goal },
        )!;

        expect(graph.states.length).toBe(stateCount);
        expect(findFirstShortestSolution(graph, goal)).toEqual(solution);
        expect(countShortestSolutions(graph, goal)).toBe(1);
      },
    );

    test.each(candidates)(
      "$id の到達できるどの状態でも、4方向の滑りが1マスずつ進める実装と一致すること",
      ({ board: candidateBoard, start, goal }) => {
        const graph = exploreIceFloorMazeStates(
          candidateBoard,
          createIceFloorMazeInitialState(candidateBoard, start),
          { goal },
        )!;

        const mismatches = graph.states.flatMap((state) => {
          const grid = state.cells.map((cell) => notationByCell[cell]);
          return iceFloorMazeDirections.flatMap((direction) => {
            const slide = slideIceFloorMazePiece(
              candidateBoard,
              state,
              direction,
            );
            const actual =
              slide.status === "slid"
                ? {
                    position: slide.to,
                    grid: applyIceFloorMazeSlide(state, slide).cells.map(
                      (cell) => notationByCell[cell],
                    ),
                  }
                : null;
            const expected = slideOneCellAtATime(
              candidateBoard,
              grid,
              state.position,
              direction,
            );
            return JSON.stringify(actual) === JSON.stringify(expected)
              ? []
              : [{ state, direction }];
          });
        });

        expect(mismatches).toEqual([]);
      },
    );
  });
});

import {
  type BridgesBoard,
  type BridgesIsland,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  type BridgesPuzzleState,
  createInitialBridgesState,
} from "@/games/bridges/puzzle/state";
import { cycleBridgesEdge } from "@/games/bridges/puzzle/transitions";
import {
  createProblemSeededRandom,
  type ProblemRandom,
} from "@/games/problem-seed";

// 0 . 1
// . . .
// 2 . . . 3
// . . .
// . . 4
// 辺: 0 = 島0-島1（横）、1 = 島0-島2（縦）、2 = 島1-島4（縦）、3 = 島2-島3（横）。辺2と辺3が交わる。
const board = parseBridgesBoard(["1.1..", ".....", "1...1", ".....", "..1.."]);
const initial = createInitialBridgesState(board);

function applyCycles(
  state: BridgesPuzzleState,
  edges: readonly number[],
): BridgesPuzzleState {
  return edges.reduce((current, edge) => {
    const change = cycleBridgesEdge(board, current, edge);
    return change.kind === "changed" ? change.state : current;
  }, state);
}

describe("cycleBridgesEdge", () => {
  test.each([
    [1, [0, 1, 0, 0]],
    [2, [0, 2, 0, 0]],
    [3, [0, 0, 0, 0]],
  ])("同じ辺を %s 回押すと 1本 → 2本 → なし と回ること", (times, expected) => {
    const state = applyCycles(
      initial,
      Array.from({ length: times }, () => 1),
    );

    expect(state.bridges).toEqual(expected);
  });

  test.each([
    [1, [0, 2, 0, 0]],
    [2, [0, 1, 0, 0]],
    [3, [0, 0, 0, 0]],
  ])(
    "逆の向きで同じ辺を %s 回回すと なし → 2本 → 1本 → なし と回ること",
    (times, expected) => {
      const state = Array.from({ length: times }).reduce<BridgesPuzzleState>(
        (current) => {
          const change = cycleBridgesEdge(board, current, 1, "backward");
          return change.kind === "changed" ? change.state : current;
        },
        initial,
      );

      expect(state.bridges).toEqual(expected);
    },
  );

  test("交わる辺に橋があると、逆の向きでも架けないこと", () => {
    const change = cycleBridgesEdge(
      board,
      applyCycles(initial, [3]),
      2,
      "backward",
    );

    expect(change).toEqual({ kind: "blocked", crossingEdges: [3] });
  });

  describe("交わる辺に橋がある場合", () => {
    const crossed = applyCycles(initial, [3]);

    test("架けずに、交わる橋のある辺を返すこと", () => {
      const change = cycleBridgesEdge(board, crossed, 2);

      expect(change).toEqual({ kind: "blocked", crossingEdges: [3] });
    });
  });

  describe("交わる辺の橋を外した後の場合", () => {
    const cleared = applyCycles(initial, [3, 3, 3]);

    test("架けられること", () => {
      const change = cycleBridgesEdge(board, cleared, 2);

      expect(change).toEqual({
        kind: "changed",
        state: { bridges: [0, 0, 1, 0] },
      });
    });
  });

  describe("盤面に無い辺の場合", () => {
    test("拒むこと", () => {
      const act = () => cycleBridgesEdge(board, initial, 4);

      expect(act).toThrow(RangeError);
    });
  });
});

function createRandomBoard(random: ProblemRandom): BridgesBoard {
  const width = 3 + Math.floor(random() * 8);
  const height = 3 + Math.floor(random() * 8);
  const occupied = new Set<string>();
  const islands: BridgesIsland[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const touches =
        occupied.has(`${row - 1},${column}`) ||
        occupied.has(`${row},${column - 1}`);
      if (!touches && random() < 0.4) {
        occupied.add(`${row},${column}`);
        islands.push({ row, column, clue: 1 });
      }
    }
  }
  return { width, height, islands };
}

/** 橋をマス目に描き、横と縦の橋が同じマスを通るマスがあるか。 */
function hasCrossingBridgesNaively(
  randomBoard: BridgesBoard,
  state: BridgesPuzzleState,
): boolean {
  const { edges } = getBridgesNetwork(randomBoard);
  const horizontal = new Set<string>();
  const vertical = new Set<string>();
  for (const [edge, { from, to, orientation }] of edges.entries()) {
    if (state.bridges[edge] === 0) {
      continue;
    }
    const a = randomBoard.islands[from]!;
    const b = randomBoard.islands[to]!;
    for (let row = a.row; row <= b.row; row += 1) {
      for (let column = a.column; column <= b.column; column += 1) {
        (orientation === "horizontal" ? horizontal : vertical).add(
          `${row},${column}`,
        );
      }
    }
  }
  return [...horizontal].some((cell) => {
    const isIsland = randomBoard.islands.some(
      ({ row, column }) => `${row},${column}` === cell,
    );
    return !isIsland && vertical.has(cell);
  });
}

describe("ランダムな盤面でランダムに辺を押し続けた場合", () => {
  const random = createProblemSeededRandom("bridges-transitions");
  const runs = Array.from({ length: 100 }, () => {
    const randomBoard = createRandomBoard(random);
    const edgeCount = getBridgesNetwork(randomBoard).edges.length;
    const states: BridgesPuzzleState[] = [];
    let blockedCount = 0;
    let state = createInitialBridgesState(randomBoard);
    for (let step = 0; step < 60 && edgeCount > 0; step += 1) {
      const change = cycleBridgesEdge(
        randomBoard,
        state,
        Math.floor(random() * edgeCount),
      );
      if (change.kind === "changed") {
        state = change.state;
        states.push(state);
      } else {
        blockedCount += 1;
      }
    }
    return { randomBoard, states, blockedCount };
  });

  test("阻まれた操作を含むこと", () => {
    const blockedTotal = runs.reduce(
      (total, { blockedCount }) => total + blockedCount,
      0,
    );

    expect(blockedTotal).toBeGreaterThan(0);
  });

  test("交わる2本の橋が同時に架からないこと", () => {
    const crossed = runs.flatMap(({ randomBoard, states }) =>
      states.filter((state) => hasCrossingBridgesNaively(randomBoard, state)),
    );

    expect(crossed).toEqual([]);
  });
});

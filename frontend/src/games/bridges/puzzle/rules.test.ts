import {
  type BridgesBoard,
  type BridgesIsland,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  areBridgesIslandsConnected,
  type BridgesIslandStatus,
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type {
  BridgeCount,
  BridgesPuzzleState,
} from "@/games/bridges/puzzle/state";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

type CellPosition = readonly [row: number, column: number];
type PlacedBridge = readonly [CellPosition, CellPosition, BridgeCount];

/** 島の位置の組で書いた橋から状態を作る。 */
function createState(
  board: BridgesBoard,
  placed: readonly PlacedBridge[],
): BridgesPuzzleState {
  const { edges } = getBridgesNetwork(board);
  const bridges = edges.map((): BridgeCount => 0);
  for (const [[fromRow, fromColumn], [toRow, toColumn], count] of placed) {
    const edge = edges.findIndex(({ from, to }) => {
      const a = board.islands[from]!;
      const b = board.islands[to]!;
      return (
        a.row === fromRow &&
        a.column === fromColumn &&
        b.row === toRow &&
        b.column === toColumn
      );
    });
    if (edge < 0) {
      throw new RangeError(`No edge between ${fromRow},${fromColumn}`);
    }
    bridges[edge] = count;
  }
  return { bridges };
}

/**
 * 橋をマス目に描いて、島の本数・交差・つながりを数える素朴な判定器。
 * 辺の一覧は、架けた橋の両端の島からマス目に線を描くためにだけ使う。交差の一覧・島ごとの辺・つながりの判定は使わず、
 * マスに書いた線と、島から4方向へ伸びる線だけを見る。
 */
function judgeNaively(board: BridgesBoard, state: BridgesPuzzleState) {
  const { edges } = getBridgesNetwork(board);
  type Line = { horizontal: number; vertical: number };
  const lines: Line[][] = Array.from({ length: board.height }, () =>
    Array.from({ length: board.width }, () => ({ horizontal: 0, vertical: 0 })),
  );
  for (const [edge, { from, to }] of edges.entries()) {
    const count = state.bridges[edge]!;
    const a = board.islands[from]!;
    const b = board.islands[to]!;
    for (let row = a.row; row <= b.row; row += 1) {
      for (let column = a.column; column <= b.column; column += 1) {
        const isEndpoint =
          (row === a.row && column === a.column) ||
          (row === b.row && column === b.column);
        if (!isEndpoint) {
          const key = a.row === b.row ? "horizontal" : "vertical";
          lines[row]![column]![key] += count;
        }
      }
    }
  }
  const crossed = lines.some((cells) =>
    cells.some(({ horizontal, vertical }) => horizontal > 0 && vertical > 0),
  );
  const islandAt = new Map(
    board.islands.map((island, index) => [
      `${island.row},${island.column}`,
      index,
    ]),
  );
  const statuses = board.islands.map(
    ({ row, column, clue }): BridgesIslandStatus => {
      const count =
        (lines[row]?.[column + 1]?.horizontal ?? 0) +
        (lines[row]?.[column - 1]?.horizontal ?? 0) +
        (lines[row + 1]?.[column]?.vertical ?? 0) +
        (lines[row - 1]?.[column]?.vertical ?? 0);
      return count < clue ? "short" : count === clue ? "exact" : "over";
    },
  );
  const reached = new Set<number>([0]);
  const pending = [board.islands[0]!];
  for (
    let island: BridgesIsland | undefined = pending.pop();
    island !== undefined;
    island = pending.pop()
  ) {
    for (const [rowStep, columnStep, key] of [
      [0, 1, "horizontal"],
      [0, -1, "horizontal"],
      [1, 0, "vertical"],
      [-1, 0, "vertical"],
    ] as const) {
      let row = island.row + rowStep;
      let column = island.column + columnStep;
      while ((lines[row]?.[column]?.[key] ?? 0) > 0) {
        row += rowStep;
        column += columnStep;
      }
      const other = islandAt.get(`${row},${column}`);
      const moved =
        row !== island.row + rowStep || column !== island.column + columnStep;
      if (moved && other !== undefined && !reached.has(other)) {
        reached.add(other);
        pending.push(board.islands[other]!);
      }
    }
  }
  const connected = reached.size === board.islands.length;
  return {
    statuses,
    connected,
    solved:
      !crossed && connected && statuses.every((status) => status === "exact"),
  };
}

function randomInteger(
  random: ProblemRandom,
  minimum: number,
  maximum: number,
) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

/** 島が上下左右に隣り合わないよう、ランダムに島を置いた盤面。 */
function createRandomBoard(random: ProblemRandom): BridgesBoard {
  const width = randomInteger(random, 3, 10);
  const height = randomInteger(random, 3, 10);
  const occupied = new Set<string>();
  const islands: BridgesIsland[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const touches =
        occupied.has(`${row - 1},${column}`) ||
        occupied.has(`${row},${column - 1}`);
      if (!touches && random() < 0.35) {
        occupied.add(`${row},${column}`);
        islands.push({ row, column, clue: randomInteger(random, 1, 8) });
      }
    }
  }
  return islands.length === 0
    ? { width, height, islands: [{ row: 0, column: 0, clue: 1 }] }
    : { width, height, islands };
}

/** 交差を気にせず、辺ごとにランダムな本数を置いた状態。 */
function createRandomState(
  board: BridgesBoard,
  random: ProblemRandom,
): BridgesPuzzleState {
  return {
    bridges: getBridgesNetwork(board).edges.map(
      () => randomInteger(random, 0, 2) as BridgeCount,
    ),
  };
}

/** 交わる橋を作らないよう、ランダムな順に辺へ本数を置いた状態。 */
function createRandomPlanarState(
  board: BridgesBoard,
  random: ProblemRandom,
): BridgesPuzzleState {
  const { edges, crossingEdges } = getBridgesNetwork(board);
  const bridges = edges.map((): BridgeCount => 0);
  const order = shuffleProblemValues(
    edges.map((_, edge) => edge),
    random,
  );
  for (const edge of order) {
    const free = crossingEdges[edge]!.every((other) => bridges[other] === 0);
    if (free && random() < 0.7) {
      bridges[edge] = randomInteger(random, 1, 2) as BridgeCount;
    }
  }
  return { bridges };
}

/**
 * 島0から、交わらない橋で木を育てて閉路の橋を少し足し、橋のつながった島だけを残して本数を数字にした盤面と配置。
 * 島が1つしか残らなければ `null`。
 */
function createRandomSolvedSample(
  random: ProblemRandom,
): { board: BridgesBoard; state: BridgesPuzzleState } | null {
  const board = createRandomBoard(random);
  const { edges, crossingEdges } = getBridgesNetwork(board);
  const bridges = edges.map((): BridgeCount => 0);
  function isFree(edge: number): boolean {
    return crossingEdges[edge]!.every((other) => bridges[other] === 0);
  }
  const reached = new Set([0]);
  for (;;) {
    const frontier = edges
      .map((edge, index) => ({ edge, index }))
      .filter(
        ({ edge, index }) =>
          reached.has(edge.from) !== reached.has(edge.to) && isFree(index),
      );
    if (frontier.length === 0) {
      break;
    }
    const { edge, index } = frontier[Math.floor(random() * frontier.length)]!;
    bridges[index] = randomInteger(random, 1, 2) as BridgeCount;
    reached.add(edge.from).add(edge.to);
  }
  for (const [index, edge] of edges.entries()) {
    const inside = reached.has(edge.from) && reached.has(edge.to);
    if (inside && bridges[index] === 0 && isFree(index) && random() < 0.3) {
      bridges[index] = randomInteger(random, 1, 2) as BridgeCount;
    }
  }
  if (reached.size < 2) {
    return null;
  }
  const kept = board.islands.flatMap((island, index) =>
    reached.has(index) ? [{ island, index }] : [],
  );
  const placed = edges.flatMap(({ from, to }, index): PlacedBridge[] => {
    const a = board.islands[from]!;
    const b = board.islands[to]!;
    return bridges[index] === 0
      ? []
      : [[[a.row, a.column], [b.row, b.column], bridges[index]!]];
  });
  const unclued: BridgesBoard = {
    ...board,
    islands: kept.map(({ island }) => island),
  };
  const state = createState(unclued, placed);
  const { islandEdges } = getBridgesNetwork(unclued);
  return {
    board: {
      ...unclued,
      islands: unclued.islands.map((island, index) => ({
        ...island,
        clue: islandEdges[index]!.reduce(
          (total, edge) => total + state.bridges[edge]!,
          0,
        ),
      })),
    },
    state,
  };
}

describe("固定問題の場合", () => {
  const board = parseBridgesBoard([
    "2..2..2",
    ".2..3..",
    "3.1...2",
    ".2..3..",
    ".......",
    ".2.1...",
    "3...4.2",
  ]);
  const solution: readonly PlacedBridge[] = [
    [[0, 0], [0, 3], 1],
    [[0, 0], [2, 0], 1],
    [[0, 3], [0, 6], 1],
    [[0, 6], [2, 6], 1],
    [[1, 1], [1, 4], 2],
    [[1, 4], [3, 4], 1],
    [[2, 0], [2, 2], 1],
    [[2, 0], [6, 0], 1],
    [[2, 6], [6, 6], 1],
    [[3, 1], [3, 4], 1],
    [[3, 1], [5, 1], 1],
    [[3, 4], [6, 4], 1],
    [[5, 1], [5, 3], 1],
    [[6, 0], [6, 4], 2],
    [[6, 4], [6, 6], 1],
  ];
  const solved = createState(board, solution);
  const missingOne = createState(board, solution.slice(1));
  // 島 (1,1) の橋を外し、島 (1,4) の3本を下の島への2本にまとめる。
  const isolated = createState(board, [
    ...solution.filter(([[row]]) => row !== 1),
    [[1, 4], [3, 4], 2],
  ]);

  describe("isBridgesSolved", () => {
    test("正解の配置でクリアになること", () => {
      const result = isBridgesSolved(board, solved);

      expect(result).toBe(true);
    });

    test.each([
      ["橋が1本足りない", missingOne],
      ["数字の合わない島がある", isolated],
    ])("%s配置ではクリアにならないこと", (_, state) => {
      const result = isBridgesSolved(board, state);

      expect(result).toBe(false);
    });
  });

  describe("listBridgesIslandStatuses", () => {
    test("正解の配置で全部の島がちょうどになること", () => {
      const statuses = listBridgesIslandStatuses(board, solved);

      expect(statuses).toEqual(board.islands.map(() => "exact"));
    });
  });

  describe("areBridgesIslandsConnected", () => {
    test("正解の配置で全部の島がつながること", () => {
      const connected = areBridgesIslandsConnected(board, solved);

      expect(connected).toBe(true);
    });
  });
});

describe("数字はちょうどでも全部の島がつながらない場合", () => {
  // 1-1 の組が2つ。どの島もちょうどだが、2つの組に分かれる。
  const board = parseBridgesBoard(["1.1", "...", "1.1"]);
  const state = createState(board, [
    [[0, 0], [0, 2], 1],
    [[2, 0], [2, 2], 1],
  ]);

  test("クリアにならないこと", () => {
    const result = isBridgesSolved(board, state);

    expect(result).toBe(false);
  });

  test("全部の島がちょうどであること", () => {
    const statuses = listBridgesIslandStatuses(board, state);

    expect(statuses).toEqual(["exact", "exact", "exact", "exact"]);
  });
});

describe("交わる2本の橋がある場合", () => {
  // 横 (2,0)-(2,4) と縦 (0,2)-(4,2) が (2,2) で交わる。交差を除けば、どの島もちょうどで全部つながる。
  const board = parseBridgesBoard([
    "2.2..",
    ".....",
    "2...1",
    ".....",
    "..1..",
  ]);
  const crossing = createState(board, [
    [[0, 0], [0, 2], 1],
    [[0, 0], [2, 0], 1],
    [[2, 0], [2, 4], 1],
    [[0, 2], [4, 2], 1],
  ]);

  test("本数とつながりが合っていてもクリアにならないこと", () => {
    const result = isBridgesSolved(board, crossing);

    expect(result).toBe(false);
  });
});

describe("ランダムな盤面と途中の配置の場合", () => {
  const random = createProblemSeededRandom("bridges-rules");
  const samples = Array.from({ length: 300 }, (_, index) => {
    const board = createRandomBoard(random);
    const state =
      index % 2 === 0
        ? createRandomState(board, random)
        : createRandomPlanarState(board, random);
    return { board, state, naive: judgeNaively(board, state) };
  });

  test("つながる配置とつながらない配置、全部の判定の種類を含むこと", () => {
    const kinds = new Set(
      samples.flatMap(({ naive }) => [
        `connected:${naive.connected}`,
        ...naive.statuses,
      ]),
    );

    expect([...kinds].sort()).toEqual([
      "connected:false",
      "connected:true",
      "exact",
      "over",
      "short",
    ]);
  });

  test("島ごとの判定が素朴な判定器と一致すること", () => {
    const statuses = samples.map(({ board, state }) =>
      listBridgesIslandStatuses(board, state),
    );

    expect(statuses).toEqual(samples.map(({ naive }) => naive.statuses));
  });

  test("つながりの判定が素朴な判定器と一致すること", () => {
    const connected = samples.map(({ board, state }) =>
      areBridgesIslandsConnected(board, state),
    );

    expect(connected).toEqual(samples.map(({ naive }) => naive.connected));
  });

  test("クリアの判定が素朴な判定器と一致すること", () => {
    const solved = samples.map(({ board, state }) =>
      isBridgesSolved(board, state),
    );

    expect(solved).toEqual(samples.map(({ naive }) => naive.solved));
  });
});

describe("ランダムに作った正解の配置の場合", () => {
  const random = createProblemSeededRandom("bridges-solved-placements");
  const samples = Array.from({ length: 200 }, () =>
    createRandomSolvedSample(random),
  ).flatMap((sample) => (sample === null ? [] : [sample]));

  test("十分な数の配置を試していること", () => {
    const count = samples.length;

    expect(count).toBeGreaterThanOrEqual(150);
  });

  test("全部の島がちょうどになること", () => {
    const allExact = samples.map(({ board, state }) =>
      listBridgesIslandStatuses(board, state).every(
        (status) => status === "exact",
      ),
    );

    expect(allExact).toEqual(samples.map(() => true));
  });

  test("全部の島がつながること", () => {
    const connected = samples.map(({ board, state }) =>
      areBridgesIslandsConnected(board, state),
    );

    expect(connected).toEqual(samples.map(() => true));
  });

  test("クリアと判定すること", () => {
    const solved = samples.map(({ board, state }) =>
      isBridgesSolved(board, state),
    );

    expect(solved).toEqual(samples.map(() => true));
  });

  test("素朴な判定器もクリアと判定すること", () => {
    const solved = samples.map(
      ({ board, state }) => judgeNaively(board, state).solved,
    );

    expect(solved).toEqual(samples.map(() => true));
  });
});

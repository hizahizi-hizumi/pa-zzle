import {
  createBridgesSolverContext,
  createInitialBridgeBounds,
} from "@/games/bridges/problem/generation/bridge-bounds";
import {
  _private,
  type BridgesHumanSolveTrace,
  type BridgesReasoningRound,
  countBridgesCornerOpeningIslands,
  countBridgesOpeningEdges,
  countBridgesOpeningSaturatedIslands,
  describeBridgesSolveFingerprint,
  describeBridgesSolveFlow,
  summarizeBridgesLookaheads,
  traceBridgesHumanSolve,
} from "@/games/bridges/problem/generation/human-solver";
import researchCases from "@/games/bridges/problem/generation/research-solver-cases.json";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { areBridgesIslandsConnected } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

const cases = researchCases.map((researchCase) => ({
  ...researchCase,
  parsed: parseBridgesBoard(researchCase.board.split("/")),
}));

const { failsAfterOneStep, traceWithSeparateClosingTiers } = _private;

function countConnectivityRounds({ rounds }: BridgesHumanSolveTrace): number {
  return rounds.filter(({ tier }) => tier.startsWith("C") || tier === "D")
    .length;
}

describe("traceWithSeparateClosingTiers", () => {
  describe("研究用の解法器（scripts/research/bridges_parity_cases.py）で解いた盤面の場合", () => {
    // 研究用の解法器は、全辺の本数が決まれば全島がつながらなくても solved と返す。製品コードはそれを contradiction と返す。
    const traces = cases.map(({ parsed }) =>
      traceWithSeparateClosingTiers(parsed, "T"),
    );

    // 1手の先読み（D）は、1段進めた後の本数の破れも見て、孤立は数島のまとまりに限る点で、3島以上の組の読み（C1g）は
    // 閉じる組を見渡せる大きさに限る点で研究用の解法器と違うので、最初に C1g・D・T が要る手詰まりより前だけを比べる。
    function untilLookahead(rounds: readonly string[]): string {
      const first = rounds.findIndex(
        (round) =>
          round.startsWith("C1g:") ||
          round.startsWith("D:") ||
          round.startsWith("T:"),
      );
      return (first < 0 ? rounds : rounds.slice(0, first)).join(" ");
    }

    test("3島以上の組の読みと1手の先読みより前の手詰まりの段と狭めた辺の数が一致すること", () => {
      const rounds = traces.map((trace) =>
        untilLookahead(
          trace.rounds.map(({ tier, edgeCount }) => `${tier}:${edgeCount}`),
        ),
      );

      expect(rounds).toEqual(
        cases.map((researchCase) =>
          untilLookahead(researchCase.rounds.split(" ")),
        ),
      );
    });

    test("状態が一致し、つながらない解き終わりだけを矛盾として返すこと", () => {
      const statuses = traces.map((trace) => trace.status);

      expect(statuses).toEqual(
        cases.map(({ status, parsed }, index) =>
          status === "solved" &&
          !areBridgesIslandsConnected(parsed, {
            bridges: traces[index]!.bridges as BridgeCount[],
          })
            ? "contradiction"
            : status,
        ),
      );
    });

    test("数字の読みだけで決まる行き先の割合が一致すること", () => {
      const ratios = cases.map(({ parsed }) =>
        Number(
          traceWithSeparateClosingTiers(parsed, "A2").decidedEdgeRatio.toFixed(
            6,
          ),
        ),
      );

      expect(ratios).toEqual(
        cases.map(
          ({ countReasoningDecidedRatio }) => countReasoningDecidedRatio,
        ),
      );
    });

    test("試し置き・唯一の通り道・1手の先読みの段を含むこと", () => {
      const tiers = new Set(
        cases.flatMap(({ rounds }) =>
          rounds.split(" ").map((step) => step.split(":")[0]),
        ),
      );

      expect([...tiers].sort()).toEqual([
        "A1",
        "A2",
        "C1g",
        "C1p",
        "C3",
        "D",
        "T",
      ]);
    });
  });
});

describe("traceBridgesHumanSolve", () => {
  describe("2島で閉じない読みで止まった手詰まりで、3島以上の組で閉じない読みも同じ局面で使える盤面の場合", () => {
    // 最初のつながりの手詰まりで、C1p と同じ局面で C1g も (3,0)-(6,0) を1本までに狭められる。
    const board = parseBridgesBoard([
      ".1...2...2",
      "1.2.3.2.1.",
      "..........",
      "2.2.5..3.2",
      "..........",
      ".2..5...1.",
      "3.1.......",
      "....2...1.",
      "..........",
      "1...2.2.2.",
    ]);

    test("2つの読みを1回の手詰まりと数え、別に当てるより1回少ないこと", () => {
      const counts = [
        countConnectivityRounds(traceWithSeparateClosingTiers(board, "D")),
        countConnectivityRounds(traceBridgesHumanSolve(board, "D")),
      ];

      expect(counts).toEqual([4, 3]);
    });
  });

  describe("研究用の解法器で解いた盤面の場合", () => {
    test("どの盤面でも、つながりの手詰まりが閉じない読みを別に当てたときより増えないこと", () => {
      const increased = cases.filter(
        ({ parsed }) =>
          countConnectivityRounds(traceBridgesHumanSolve(parsed, "D")) >
          countConnectivityRounds(traceWithSeparateClosingTiers(parsed, "D")),
      );

      expect(increased).toEqual([]);
    });
  });

  describe("2島を閉じない読みを当てて数字の読みで進めれば、3島以上の組の読みと同じ所まで決まる盤面の場合", () => {
    const board = parseBridgesBoard([
      "2.3.2",
      ".....",
      "....2",
      "..1..",
      "2...2",
    ]);

    test("その手詰まりを2島で閉じない読みと数えること", () => {
      const tiers = traceBridgesHumanSolve(board, "D").rounds.map(
        ({ tier }) => tier,
      );

      expect(tiers).toEqual(["A1", "C1p", "A1", "A1"]);
    });
  });

  describe("架かると決まった橋が、両端の島がまだ足りない行き先と交わる盤面の場合", () => {
    // 上の 2 は行き先が下の 3 だけで2本と決まり、左の 1 と右の 2 の間の行き先を塞ぐ。
    const board = parseBridgesBoard([
      "..2..",
      "1...2",
      "..3..",
      ".....",
      "2.3.3",
    ]);

    test("交差で塞がった行き先を数えること", () => {
      expect(traceBridgesHumanSolve(board, "D").crossingBlockCount).toBe(1);
    });
  });

  describe("数字の読みだけで決まる盤面の場合", () => {
    // 真ん中の 3 は行き先が3つで、どれにも1本ずつ要る。
    const board = parseBridgesBoard(["1.3.1", ".....", "..1.."]);

    test("数字の読みで決まり、解いた橋を返すこと", () => {
      const trace = traceBridgesHumanSolve(board);

      expect({ status: trace.status, bridges: trace.bridges }).toEqual({
        status: "solved",
        bridges: [1, 1, 1],
      });
    });
  });

  describe("全辺の本数が決まっても全島がつながらない盤面の場合", () => {
    // 1-1 の組が2つ。どちらの組も行き先が1つずつで数字の読みで決まるが、2組に分かれる。
    const board = parseBridgesBoard(["1.1...", "......", "...1.1"]);

    test("矛盾として返すこと", () => {
      const trace = traceBridgesHumanSolve(board, "A2");

      expect(trace.status).toBe("contradiction");
    });
  });

  describe("数字が規則と合わない盤面の場合", () => {
    const board = parseBridgesBoard(["3.1"]);

    test("矛盾として返すこと", () => {
      const trace = traceBridgesHumanSolve(board);

      expect(trace.status).toBe("contradiction");
    });
  });
});

describe("failsAfterOneStep", () => {
  function findEdge(
    board: ReturnType<typeof parseBridgesBoard>,
    from: readonly [number, number],
    to: readonly [number, number],
  ): number {
    const index = (cell: readonly [number, number]) =>
      board.islands.findIndex(
        ({ row, column }) => row === cell[0] && column === cell[1],
      );
    return createBridgesSolverContext(board).endpoints.findIndex(
      ([start, end]) => start === index(from) && end === index(to),
    );
  }

  function tryAssumption(
    rows: readonly string[],
    from: readonly [number, number],
    to: readonly [number, number],
    assumed: { lower?: number; upper?: number },
  ) {
    const board = parseBridgesBoard(rows);
    const context = createBridgesSolverContext(board);
    return failsAfterOneStep(
      context,
      createInitialBridgeBounds(context),
      findEdge(board, from, to),
      assumed,
    );
  }

  test("両端の島を埋めて行き先が消え、隣の島の本数が足りなくなる手を退けること", () => {
    // 左上の 1 を右の 3 へつなぐと 1 が足り、下の 3 は右の 4 への2本だけになる。
    const failure = tryAssumption(
      ["1.3.2", ".....", ".....", "....1", "3.4.."],
      [0, 0],
      [0, 2],
      { lower: 1 },
    );

    expect(failure).toBe("count");
  });

  test("4島以下のまとまりが残りとつながらなくなる手を、孤立として退けること", () => {
    const failure = tryAssumption(
      [
        ".2....4",
        "2..4.2.",
        ".......",
        "......3",
        "2..4.1.",
        ".......",
        ".1.4..3",
      ],
      [6, 1],
      [6, 3],
      { upper: 0 },
    );

    expect(failure).toBe("isolated");
  });

  test("5島以上のまとまりが残りとつながらなくなるだけの手は、1手の先読みでは退けないこと", () => {
    const failure = tryAssumption(
      ["4...2.", ".2.4.1", "......", "4..3.1", "......", "3...2."],
      [3, 0],
      [3, 3],
      { upper: 0 },
    );

    expect(failure).toBeNull();
  });
});

describe("failsAfterOneStep で閉じる組の大きさ", () => {
  /**
   * 上の行に `chained` 島の 1-2-…-2-1 の列、2行下の奇数列に `others` 島の列を置き、上の列の最後の1組を除く橋を架けた局面で、
   * 最後の1組を架ける手を試す。架けると上の列が全島ではない閉じた組になる。
   */
  function tryClosingChain(chained: number, others: number) {
    const width = chained * 2 - 1;
    const row = (count: number, offset: number) =>
      Array.from({ length: width }, (_, column) => {
        const index = (column - offset) / 2;
        if (column < offset || !Number.isInteger(index) || index >= count) {
          return ".";
        }
        return index === 0 || index === count - 1 ? "1" : "2";
      }).join("");
    const board = parseBridgesBoard([
      row(chained, 0),
      ".".repeat(width),
      row(others, 1),
    ]);
    const context = createBridgesSolverContext(board);
    const bounds = createInitialBridgeBounds(context);
    const chainEdges = context.endpoints.flatMap(([from, to], edge) =>
      board.islands[from]!.row === 0 && board.islands[to]!.row === 0
        ? [edge]
        : [],
    );
    for (const edge of chainEdges.slice(0, -1)) {
      bounds.lower[edge] = 1;
      bounds.upper[edge] = 1;
    }
    return failsAfterOneStep(context, bounds, chainEdges.at(-1)!, {
      lower: 1,
    });
  }

  test.each([
    [7, 6, "closed-group"],
    [8, 5, "closed-group"],
    [8, 6, null],
  ] as const)(
    "%d島の組が閉じ、外に%d島残る手を %s とすること",
    (chained, others, expected) => {
      expect(tryClosingChain(chained, others)).toBe(expected);
    },
  );
});

describe("summarizeBridgesLookaheads", () => {
  function round(
    tier: BridgesReasoningRound["tier"],
    edges: readonly number[],
    flags: Partial<BridgesReasoningRound> = {},
  ): BridgesReasoningRound {
    return {
      tier,
      edgeCount: edges.length,
      edges,
      readsGroup: false,
      readsCount: false,
      lowersUpper: false,
      readsIsolation: false,
      lowersUpperByReading: false,
      decidedRatio: 0,
      ...flags,
    };
  }

  test("続けて同じ行き先を狭めた先読みは1つにまとめ、見た破れを合わせること", () => {
    const summary = summarizeBridgesLookaheads([
      round("D", [3], { readsGroup: true }),
      round("A1", [1, 2]),
      round("D", [3, 4], { readsCount: true }),
    ]);

    expect(summary).toMatchObject({
      lookaheads: [{ readsGroup: true, readsCount: true }],
      mergedRoundCount: 1,
      spotCount: 1,
      longestChain: 1,
    });
  });

  test("続けて別の行き先で要った先読みは同じ場所で続く先読み、間が空いた先読みは別の場所と数えること", () => {
    const summary = summarizeBridgesLookaheads([
      round("D", [1]),
      round("A1", [2]),
      round("D", [5]),
      round("A1", [6, 7, 8, 9]),
      round("D", [10]),
    ]);

    expect(summary).toMatchObject({
      mergedRoundCount: 0,
      spotCount: 2,
      longestChain: 2,
    });
    expect(summary.lookaheads).toHaveLength(3);
  });
});

describe("countBridgesOpeningEdges", () => {
  describe("研究用の解法器で数えた盤面の場合", () => {
    test("解き始めに数字の読みで狭められる辺の数が一致すること", () => {
      const counts = cases.map(({ parsed }) =>
        countBridgesOpeningEdges(parsed),
      );

      expect(counts).toEqual(
        cases.map(({ openingEdgeCount }) => openingEdgeCount),
      );
    });
  });
});

describe("countBridgesOpeningSaturatedIslands", () => {
  test.each([
    ["行き先2つの4", ["2.4.2"], 1],
    ["行き先3つの6", ["..2..", ".....", "2.6.2"], 1],
    ["相手が1なので上限まで出す3", ["1.3.2"], 1],
    ["行き先が2つで上限4に届かない3", ["2.3.1", ".....", "..2.."], 0],
    ["数字2で行き先が1つの島（決め打ちに数えない）", ["2.2"], 0],
  ] as const)("%sの盤面で %s を返すこと", (_, rows, expected) => {
    const count = countBridgesOpeningSaturatedIslands(parseBridgesBoard(rows));

    expect(count).toBe(expected);
  });
});

describe("countBridgesCornerOpeningIslands", () => {
  test.each([
    ["四隅の 4 に行き先2つ", ["4.2", "...", "2.."], 1],
    ["四隅でない 4 に行き先2つ", ["....", "2..4", "....", "...2"], 0],
  ] as const)("%sの盤面で %s を返すこと", (_, rows, expected) => {
    expect(countBridgesCornerOpeningIslands(parseBridgesBoard(rows))).toBe(
      expected,
    );
  });
});

describe("describeBridgesSolveFlow", () => {
  test("手詰まりごとの段と狭めた組の数を順に並べること", () => {
    const flow = describeBridgesSolveFlow(parseBridgesBoard(["2.4.2"]));

    expect(flow).toBe("A1:2");
  });
});

describe("describeBridgesSolveFingerprint", () => {
  test("手詰まりごとに、狭めた組の両端の数字と外周に沿うかを並べること", () => {
    const fingerprint = describeBridgesSolveFingerprint(
      parseBridgesBoard(["2.4.2"]),
    );

    expect(fingerprint).toBe("A1:24b.24b");
  });

  test("流れが同じでも、読む数字の組が違えば別の指紋になること", () => {
    const fingerprints = [
      ["2.4.2", ".....", "....."],
      [".....", "2.4.2", "....."],
    ].map((rows) => describeBridgesSolveFingerprint(parseBridgesBoard(rows)));

    expect(fingerprints[0]).not.toBe(fingerprints[1]);
  });
});

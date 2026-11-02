import {
  countBridgesOpeningEdges,
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

describe("traceBridgesHumanSolve", () => {
  describe("研究用の解法器（scripts/research/bridges_parity_cases.py）で解いた盤面の場合", () => {
    // 研究用の解法器は、全辺の本数が決まれば全島がつながらなくても solved と返す。製品コードはそれを contradiction と返す。
    const traces = cases.map(({ parsed }) =>
      traceBridgesHumanSolve(parsed, "T"),
    );

    test("手詰まりごとの段と狭めた辺の数が一致すること", () => {
      const rounds = traces.map((trace) =>
        trace.rounds
          .map(({ tier, edgeCount }) => `${tier}:${edgeCount}`)
          .join(" "),
      );

      expect(rounds).toEqual(cases.map((researchCase) => researchCase.rounds));
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
          traceBridgesHumanSolve(parsed, "A2").decidedEdgeRatio.toFixed(6),
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

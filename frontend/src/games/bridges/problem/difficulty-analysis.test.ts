import { analyzeBridgesDifficulty } from "@/games/bridges/problem/difficulty-analysis";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";

describe("analyzeBridgesDifficulty", () => {
  describe("つながりの1手の先読みが要る一意解の問題の場合", () => {
    // 研究用の解法器では A2:2 A1:2 A2:2 A1:1 D:3 A1:6 A1:1（research-solver-cases.json の先頭）。
    const problem = parseBridgesBoard([
      "3.3.1.",
      "......",
      "..1...",
      "2...3.",
      "......",
      "2.3.2.",
    ]);

    test("規模・推論の段の回数・数字だけで決まらない割合を返すこと", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        requiresTrial: false,
        scale: { size: 6, islandCount: 9 },
        reasoning: {
          maximumTier: "D",
          countRoundCount: 2,
          connectivityRoundCount: 1,
          countReasoningUndecidedRatio: 1,
        },
      });
    });

    test("素朴な解き方の結果が、同じ盤面では同じになること", () => {
      const trials = [0, 1].map(() => {
        const analysis = analyzeBridgesDifficulty(problem);
        return analysis.status === "analyzed" && !analysis.requiresTrial
          ? analysis.trial
          : null;
      });

      expect(trials[0]).toEqual(trials[1]);
    });
  });

  describe("推理では決まらず試し置きが要る一意解の問題の場合", () => {
    const problem = parseBridgesBoard([
      ".......",
      "2...3.2",
      ".......",
      "2.1...2",
      ".......",
      "3.4.2.1",
      ".......",
    ]);

    test("試し置きが要ることを返すこと", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        requiresTrial: true,
      });
    });
  });

  test.each([
    ["どうつないでも2組に分かれる", ["1.1", "...", "1.1"], "no-solution"],
    ["本数が合わない", ["2.1"], "no-solution"],
    [
      "2本にする組を縦と横で入れ替えられる",
      ["3.3", "...", "3.3"],
      "multiple-solutions",
    ],
  ] as const)("%s問題を成立しない問題として返すこと", (_, rows, reason) => {
    const analysis = analyzeBridgesDifficulty(parseBridgesBoard(rows));

    expect(analysis).toEqual({ status: "invalid", reason });
  });
});

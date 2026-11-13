import { assessBridgesDifficulty } from "@/games/bridges/difficulty";
import { analyzeBridgesDifficulty } from "@/games/bridges/problem/difficulty-analysis";
import {
  listBridgesPoolEntries,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import {
  type BridgesBoard,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { difficultyLevels } from "@/games/difficulty";

function listOrientations(board: BridgesBoard): BridgesBoard[] {
  return [false, true].flatMap((transposed) =>
    [false, true].flatMap((flipsRows) =>
      [false, true].map((flipsColumns) => {
        const size = board.width;
        const islands = board.islands
          .map(({ row, column, clue }) => {
            const baseRow = transposed ? column : row;
            const baseColumn = transposed ? row : column;
            return {
              row: flipsRows ? size - 1 - baseRow : baseRow,
              column: flipsColumns ? size - 1 - baseColumn : baseColumn,
              clue,
            };
          })
          .sort((a, b) => a.row - b.row || a.column - b.column);
        return { width: size, height: size, islands };
      }),
    ),
  );
}

describe("analyzeBridgesDifficulty", () => {
  describe("つながりの1手の先読みが要る一意解の問題の場合", () => {
    // 研究用の解法器では A2:2 A1:2 A2:2 A1:1 D:3 A1:6 A1:1（research-solver-cases.json の先頭）。D の前の数字の読みは、
    // A2 を2回当てても1つのまとまり。
    const problem = parseBridgesBoard([
      "3.3.1.",
      "......",
      "..1...",
      "2...3.",
      "......",
      "2.3.2.",
    ]);

    test("規模・推論の段の回数・数字だけで決まらない割合・先読みの回数を返すこと", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        requiresTrial: false,
        scale: {
          size: 6,
          islandCount: 9,
          bridgeCount: 10,
          highClueCount: 0,
          loopCount: 0,
        },
        reasoning: {
          maximumTier: "D",
          countRoundCount: 1,
          connectivityRoundCount: 1,
          countReasoningUndecidedRatio: 1,
          lookaheadRoundCount: 1,
          closureRoundCount: 0,
          openingSaturatedIslandCount: 0,
        },
      });
    });

    test("数字の平均・同じ数字の割合・2本の組の割合を、盤面と解から求めること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        scale: {
          clueMean: 20 / 9,
          dominantClueShare: 4 / 9,
          doubleBridgeRatio: 0.25,
        },
      });
    });

    test("数字2の割合・最も大きい数字・6以上の数字の数を盤面から求めること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        scale: { twoClueShare: 3 / 9, maximumClue: 3, veryHighClueCount: 0 },
      });
    });

    test("ちょうど以外の読みの手詰まりと、続けて要った1手の先読みを数えること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        reasoning: { readingRoundCount: 2, chainedLookaheadRoundCount: 0 },
      });
    });

    test("架ける行き先の割合と島の割合、1手の先読みが見た破れの種類（本数・組・孤立）と向きを数えること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        scale: { usedEdgeShare: 8 / 11, islandShare: 9 / 36 },
        reasoning: {
          groupLookaheadRoundCount: 1,
          countLookaheadRoundCount: 0,
          cappingLookaheadRoundCount: 0,
          isolatingLookaheadRoundCount: 0,
        },
      });
    });

    test("1手の先読みの手詰まりで3組以上がまとめて決まるとき、一か所の気づきではなく掃く手詰まりに数えること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        reasoning: { sweepRoundCount: 1 },
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

  describe("1本多い手を退けて上限を下げる1手の先読みが要る問題の場合", () => {
    const problem = parseBridgesBoard([
      ".2......3",
      "1..3..2..",
      ".1......3",
      "....2.3..",
      ".2......4",
      "2...1....",
      ".2.4..5.6",
      ".........",
      "3.....5.4",
    ]);

    test("同じ手詰まりで離れた2か所の先読みを別の場所と数え、上限を下げる先読みと、本数・組・孤立を見る先読みを数えること", () => {
      const analysis = analyzeBridgesDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        reasoning: {
          lookaheadRoundCount: 2,
          lookaheadSpotCount: 2,
          cappingLookaheadRoundCount: 1,
          countLookaheadRoundCount: 1,
          groupLookaheadRoundCount: 2,
          isolatingLookaheadRoundCount: 1,
          lookaheadReasonKindCount: 4,
        },
      });
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

  describe("問題集の問題を回転・反転した場合", () => {
    const problems = difficultyLevels.flatMap(({ id }) =>
      listBridgesPoolEntries(id)
        .slice(0, 6)
        .map((entry) => toBridgesPooledProblem(entry).problem),
    );

    test("8通りのどの向きでも、レベルと分類に使う特徴が変わらないこと", () => {
      const changed = problems.filter((problem) => {
        const assessments = listOrientations(problem).map((oriented) =>
          JSON.stringify(
            assessBridgesDifficulty(analyzeBridgesDifficulty(oriented)),
          ),
        );
        return new Set(assessments).size !== 1;
      });

      expect(changed).toEqual([]);
    });
  });
});

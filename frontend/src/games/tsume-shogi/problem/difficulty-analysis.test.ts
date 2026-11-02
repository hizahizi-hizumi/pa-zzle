import { analyzeTsumeShogiDifficulty } from "@/games/tsume-shogi/problem/difficulty-analysis";
import { solveTsumeShogiMainLine } from "@/games/tsume-shogi/problem/generation/solver";
import {
  parseTsumeShogiProblemText,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";
import { parseTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  type TsumeShogiHand,
} from "@/games/tsume-shogi/puzzle/position";

function toProblem(
  board: string,
  hand: Partial<TsumeShogiHand>,
  plies: number,
): TsumeShogiProblem {
  const initialPosition = createTsumeShogiPosition(board, hand);
  return {
    initialPosition,
    plies,
    mainLine: solveTsumeShogiMainLine(initialPosition, plies).moves,
  };
}

/**
 * ▲3三銀打 △3一玉 ▲2二龍 の3手詰。初手の王手は11通り。誤王手のうち ▲4三歩成（△3一玉なら詰む）と ▲2三銀打（△2一玉なら
 * 詰む）は自然な応手の一部が詰むのでもっともらしい。残りの ▲2二龍・▲2三龍などは、自然な応手のどれでも詰まないので崩れる。
 */
const threePly = toProblem("5s3/6k2/9/5P1+R1/9/9/9/9/9", { silver: 1 }, 3);

/**
 * ▲2一馬 △同金 ▲同角成 △同玉 ▲2二金打 の5手詰。初手の王手は2通りで、誤王手の ▲2二歩成 は △同玉の1通りしか応手が無いが、
 * その後も脅しのある王手が続くので、反証が4手目以降まで見えない深い紛れになる。
 */
const fivePlyWithDeepDecoy = parseTsumeShogiProblemText({
  sfen: "6l1k/7g1/7P1/4+B4/9/2B6/9/9/9 b 2r3g4s4n3l17p 1",
  mainLine: ["5d2a", "2b2a", "7f2a+", "1a2a", "G*2b"],
});

describe("analyzeTsumeShogiDifficulty", () => {
  describe("3手詰", () => {
    test("判断地点ごとの誤王手の紛れと、作意の手筋を返すこと", () => {
      const result = analyzeTsumeShogiDifficulty(threePly);

      expect(result).toEqual({
        status: "analyzed",
        plies: 3,
        features: {
          rootChecks: 11,
          plausibleWrong: 2,
          deepDecoyCount: 0,
          defenseBranching: 0,
          tesujiKindCount: 0,
          decisions: [
            {
              remainingPlies: 3,
              checkCount: 11,
              plausibleWrongCount: 2,
              deepDecoyCount: 0,
            },
            {
              remainingPlies: 1,
              checkCount: 8,
              plausibleWrongCount: 0,
              deepDecoyCount: 0,
            },
          ],
          motifs: {
            drop: 1,
            promotion: 0,
            nonPromotion: 0,
            capture: 0,
            sacrifice: 0,
            discoveredCheck: 0,
            distantCheck: 0,
          },
        },
      });
    });
  });

  describe("深い紛れのある5手詰", () => {
    test("初手の誤王手を深い紛れとして数え、捨駒・成・駒取りの手筋を返すこと", () => {
      const result = analyzeTsumeShogiDifficulty(fivePlyWithDeepDecoy);

      expect(result).toMatchObject({ status: "analyzed" });
      if (result.status !== "analyzed") throw new Error(result.status);
      expect(result.features.decisions[0]).toEqual({
        remainingPlies: 5,
        checkCount: 2,
        plausibleWrongCount: 1,
        deepDecoyCount: 1,
      });
      expect(result.features.deepDecoyCount).toBe(1);
      expect(result.features.motifs).toMatchObject({
        drop: 1,
        promotion: 1,
        capture: 1,
        sacrifice: 2,
      });
      expect(result.features.tesujiKindCount).toBe(3);
    });
  });

  describe("どの問題でも成り立つこと", () => {
    const problems = [
      ["3手詰", threePly],
      ["5手詰", fivePlyWithDeepDecoy],
      [
        "変化同手数の5手詰",
        toProblem("8k/6S2/8B/7r1/6G2/8N/9/9/9", { pawn: 1 }, 5),
      ],
    ] as const;

    test.each(problems)(
      "%sで、判断地点は攻方の手番の数だけあり、深い紛れはもっともらしい誤王手に含まれ、最終手の誤王手はもっともらしくないこと",
      (_, problem) => {
        const result = analyzeTsumeShogiDifficulty(problem);

        if (result.status !== "analyzed") throw new Error(result.status);
        const { decisions } = result.features;
        expect(decisions).toHaveLength((problem.plies + 1) / 2);
        expect(result.features.rootChecks).toBe(decisions[0]!.checkCount);
        for (const decision of decisions) {
          expect(decision.deepDecoyCount).toBeLessThanOrEqual(
            decision.plausibleWrongCount,
          );
          if (decision.remainingPlies < 5) {
            expect(decision.deepDecoyCount).toBe(0);
          }
        }
        expect(decisions.at(-1)!.plausibleWrongCount).toBe(0);
      },
    );

    test.each(problems)("%sを2回分析して同じ結果を返すこと", (_, problem) => {
      const first = analyzeTsumeShogiDifficulty(problem);
      const second = analyzeTsumeShogiDifficulty(problem);

      expect(second).toEqual(first);
    });
  });

  describe("評価しない問題", () => {
    const cases = [
      [
        "strict validator が採用しない（駒余りの）問題",
        parseTsumeShogiProblemText({
          sfen: "4k4/9/4P4/9/9/9/9/9/9 b GS2r2b3g3s4n4l17p 1",
          mainLine: ["G*5b"],
        }),
        {
          status: "invalid",
          reason: "quality",
          plies: 1,
          issues: ["leftoverPieces"],
        },
      ],
      [
        "無駄合の解釈で答えが変わる問題",
        toProblem("6kS1/7L1/9/9/9/9/9/9/9", { rook: 2 }, 3),
        {
          status: "unsupported",
          reason: "supported-subset",
          plies: 3,
          issues: ["interpositionSensitive"],
        },
      ],
      [
        "作意が strict validator の作意と違う問題",
        {
          ...threePly,
          mainLine: [
            threePly.mainLine[0]!,
            parseTsumeShogiMoveUsi("3b2a"),
            threePly.mainLine[2]!,
          ],
        },
        {
          status: "invalid",
          reason: "main-line-mismatch",
          plies: 3,
          issues: [],
        },
      ],
      [
        "分析できる手数を超える問題",
        { ...threePly, plies: 7 },
        {
          status: "unsupported",
          reason: "beyond-analysis-horizon",
          plies: 7,
          issues: [],
        },
      ],
    ] as const;

    test.each(cases)("%sを評価せず理由を返すこと", (_, problem, expected) => {
      const result = analyzeTsumeShogiDifficulty(problem);

      expect(result).toEqual(expected);
    });
  });
});

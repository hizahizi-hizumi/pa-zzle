import {
  findTsumeShogiShortestMate,
  solveTsumeShogiMainLine,
} from "@/games/tsume-shogi/problem/generation/solver";
import { formatTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import { createTsumeShogiPosition } from "@/games/tsume-shogi/puzzle/position";

/** 1手詰: ▲5二金打。 */
const onePly = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", { gold: 1 });

/** 3手詰: ▲3三銀打 △3一玉 ▲2二龍。 */
const threePly = createTsumeShogiPosition("5s3/6k2/9/5P1+R1/9/9/9/9/9", {
  silver: 1,
});

/** 5手詰: ▲3二銀成 △1一玉 ▲1二歩打 △同玉 ▲1三香打。△1二玉と逃げると3手で詰む。 */
const fivePly = createTsumeShogiPosition("7k1/9/5S3/8+B/5P3/9/9/9/9", {
  lance: 1,
  pawn: 1,
});

/**
 * ▲2三飛成の後、玉方のどの応手も次の1手で詰む（同じ3手）。△1一玉の後だけ ▲1二銀打で持駒を使い切って詰められ、
 * ほかの応手では持駒の銀が残る。
 */
const leftoverTieBreak = createTsumeShogiPosition("7k1/9/5R2B/9/5L3/9/9/9/9", {
  silver: 1,
});

describe("findTsumeShogiShortestMate", () => {
  const cases = [
    ["1手詰を7手まで", onePly, 7, 1],
    ["3手詰を7手まで", threePly, 7, 3],
    ["5手詰を7手まで", fivePly, 7, 5],
    ["5手詰を3手まで", fivePly, 3, null],
  ] as const;

  test.each(cases)(
    "%s調べて最短手数を返すこと",
    (_, position, maximumPlies, expected) => {
      const plies = findTsumeShogiShortestMate(position, maximumPlies);

      expect(plies).toBe(expected);
    },
  );
});

describe("solveTsumeShogiMainLine", () => {
  describe("作意の手順", () => {
    const cases = [
      ["1手詰", onePly, 1, "G*5b"],
      ["3手詰", threePly, 3, "S*3c 3b3a 2d2b"],
      ["5手詰", fivePly, 5, "4c3b+ 2a1a P*1b 1a1b L*1c"],
    ] as const;

    test.each(cases)(
      "%sで玉方が最長に逃げる手順を返すこと",
      (_, position, plies, expected) => {
        const mainLine = solveTsumeShogiMainLine(position, plies);

        expect(mainLine.moves.map(formatTsumeShogiMoveUsi).join(" ")).toBe(
          expected,
        );
        expect(mainLine.leftoverAttackerPieceCount).toBe(0);
        expect(mainLine.hasDefenderInterposition).toBe(false);
      },
    );
  });

  describe("攻方の手番ごとの記録", () => {
    test("5手詰の各手番で詰む王手が1つだけであることを返すこと", () => {
      const mainLine = solveTsumeShogiMainLine(fivePly, 5);

      expect(mainLine.attackerTurns).toEqual([
        { matingCheckCount: 1 },
        { matingCheckCount: 1 },
        { matingCheckCount: 1 },
      ]);
    });
  });

  describe("同じ手数の応手", () => {
    test("詰め上がりで攻方の持駒が残らない応手を選ぶこと", () => {
      const mainLine = solveTsumeShogiMainLine(leftoverTieBreak, 3);

      expect(mainLine.moves.map(formatTsumeShogiMoveUsi)).toEqual([
        "4c2c+",
        "2a1a",
        "S*1b",
      ]);
      expect(mainLine.defenderTurns).toEqual([
        { responseCount: 8, longestResponseCount: 8, tiedResponseCount: 1 },
      ]);
      expect(mainLine.leftoverAttackerPieceCount).toBe(0);
    });
  });

  describe("最短の詰みが指定の手数と違う局面", () => {
    test("RangeError を投げること", () => {
      const act = () => solveTsumeShogiMainLine(threePly, 5);

      expect(act).toThrow(RangeError);
    });
  });
});

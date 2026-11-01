import { parseTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import { formatTsumeShogiMoveNotation } from "@/games/tsume-shogi/ui/move-notation";

describe("formatTsumeShogiMoveNotation", () => {
  const cases = [
    ["attacker", "S*2b", "silver", false, "▲2二銀打"],
    ["defender", "2a1b", "king", false, "△1二玉"],
    ["attacker", "4c3b+", "promSilver", true, "▲3二銀成"],
    ["attacker", "4c3b", "silver", true, "▲3二銀不成"],
    ["defender", "3g4h", "silver", true, "△4八銀不成"],
    ["attacker", "4c1c", "dragon", false, "▲1三龍"],
  ] as const;

  test.each(cases)(
    "%s の %s を棋譜で書くこと",
    (side, usi, pieceType, promotable, expected) => {
      const notation = formatTsumeShogiMoveNotation({
        side,
        move: parseTsumeShogiMoveUsi(usi),
        pieceType,
        promotable,
        line: "main",
      });

      expect(notation).toBe(expected);
    },
  );

  describe("直前の手と同じ升へ指した場合", () => {
    const sameSquareCases = [
      ["defender", "2a2b", "king", false, "△同玉"],
      ["attacker", "3c2b", "promPawn", false, "▲同と"],
      ["attacker", "3c2b+", "promSilver", true, "▲同銀成"],
    ] as const;
    const previousMoveTo = { file: 2, rank: 2 };

    test.each(sameSquareCases)(
      "%s の %s を「同」で書くこと",
      (side, usi, pieceType, promotable, expected) => {
        const notation = formatTsumeShogiMoveNotation(
          {
            side,
            move: parseTsumeShogiMoveUsi(usi),
            pieceType,
            promotable,
            line: "main",
          },
          previousMoveTo,
        );

        expect(notation).toBe(expected);
      },
    );
  });

  describe("直前の手と違う升へ指した場合", () => {
    const previousMoveTo = { file: 3, rank: 3 };

    test("升の名前で書くこと", () => {
      const notation = formatTsumeShogiMoveNotation(
        {
          side: "defender",
          move: parseTsumeShogiMoveUsi("2a2b"),
          pieceType: "king",
          promotable: false,
          line: "main",
        },
        previousMoveTo,
      );

      expect(notation).toBe("△2二玉");
    });
  });
});

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
});

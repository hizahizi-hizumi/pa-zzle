import { parseTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import { formatTsumeShogiMoveNotation } from "@/games/tsume-shogi/ui/move-notation";

describe("formatTsumeShogiMoveNotation", () => {
  const cases = [
    ["attacker", "S*2b", "silver", "▲2二銀打"],
    ["defender", "2a1b", "king", "△1二玉"],
    ["attacker", "4c3b+", "promSilver", "▲3二銀成"],
    ["attacker", "4c1c", "dragon", "▲1三龍"],
  ] as const;

  test.each(cases)(
    "%s の %s を棋譜で書くこと",
    (side, usi, pieceType, expected) => {
      const notation = formatTsumeShogiMoveNotation({
        side,
        move: parseTsumeShogiMoveUsi(usi),
        pieceType,
        line: "main",
      });

      expect(notation).toBe(expected);
    },
  );
});

import { getTsumeShogiLetteringGlyphPath } from "@/games/tsume-shogi/ui/board/lettering-glyph-paths";
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";

describe("getTsumeShogiLetteringGlyphPath", () => {
  describe("盤と駒箱の札に書く字の場合", () => {
    const files = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(formatTsumeShogiRank);
    const pieceBoxLabel = Array.from("玉方の持駒残り全部");
    const characters = [...files, ...ranks, ...pieceBoxLabel];

    test.each(characters)("%s の字形を返すこと", (character) => {
      const path = getTsumeShogiLetteringGlyphPath(character);

      expect(path).toMatch(/^m/);
    });
  });

  describe("字形を持たない字の場合", () => {
    const character = "十";

    test("null を返すこと", () => {
      const path = getTsumeShogiLetteringGlyphPath(character);

      expect(path).toBeNull();
    });
  });
});

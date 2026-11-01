import { CurrentPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/CurrentPieceGlyph";
import type { TsumeShogiPieceGlyphProps } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { QuietPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/QuietPieceGlyph";
import { RealMiniaturePieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/RealMiniaturePieceGlyph";
import { RealPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/RealPieceGlyph";
import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";

/**
 * 駒。駒種ごとに実物の大きさの五角形に1文字を書く。
 * 玉方の駒は将棋盤の慣例どおり 180° 回して、向きで攻方と見分ける。回しても側面・影・光は画面の下・上に置く。
 * 第三者の駒画像を使わず、図形と字形の輪郭だけで描く。
 * 案R の小さな図（遊び方・難易度のプレビュー）は、質感を省いた同じ色・同じ書体の駒で描く。
 */
export function TsumeShogiPieceGlyph(props: TsumeShogiPieceGlyphProps) {
  if (tsumeShogiBoardStyle === "quiet") return <QuietPieceGlyph {...props} />;
  if (tsumeShogiBoardStyle === "real") {
    return props.size === "figure" || props.size === "miniature" ? (
      <RealMiniaturePieceGlyph {...props} />
    ) : (
      <RealPieceGlyph {...props} />
    );
  }
  return <CurrentPieceGlyph {...props} />;
}

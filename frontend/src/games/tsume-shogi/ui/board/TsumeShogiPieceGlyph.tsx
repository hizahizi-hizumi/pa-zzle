import { DetailedPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/DetailedPieceGlyph";
import { MiniaturePieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/MiniaturePieceGlyph";
import {
  isMiniatureGlyphSize,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";

/**
 * 駒。駒種ごとに実物の大きさの五角形に1文字を書く。
 * 玉方の駒は将棋盤の慣例どおり 180° 回して、向きで攻方と見分ける。回しても影は画面の右下に落とし、光は画面の左上から当てる。
 * 第三者の駒画像を使わず、図形と字形の輪郭だけで描く。小さな図では、質感を省いた同じ色・同じ書体の駒で描く。
 */
export function TsumeShogiPieceGlyph(props: TsumeShogiPieceGlyphProps) {
  return isMiniatureGlyphSize(props.size) ? (
    <MiniaturePieceGlyph {...props} />
  ) : (
    <DetailedPieceGlyph {...props} />
  );
}

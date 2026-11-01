import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { getTsumeShogiPieceGlyphPath } from "@/games/tsume-shogi/ui/board/real/selected-fonts";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/board/real/wood-texture";

const pieceTypes = [
  "king",
  "rook",
  "bishop",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
  "dragon",
  "horse",
  "promSilver",
  "promKnight",
  "promLance",
  "promPawn",
] as const satisfies readonly TsumeShogiPieceType[];

/** 柘植の木目の1枚の大きさ（駒の座標 0.1mm）。駒2枚分ほどにし、駒ごとに位置をずらして同じ模様が並ばないようにする。 */
export const TSUGE_TILE_WIDTH = 600;
export const TSUGE_TILE_HEIGHT = 660;

/** 案R の駒が参照する塗りと字形の id。 */
export type TsumeShogiRealPieceDefIds = {
  /** 柘植の面の木目。駒の座標に固定した1組の模様で、駒ごとに画像を置かない。 */
  face: string;
  /** 面取りのにじみ。左上が光を受け、右下が陰になる。駒の向きによらず画面の左上から光を当てる。 */
  edge: string;
  /** 面の左上に乗るつや。 */
  specular: string;
  ink: string;
  vermilion: string;
  /** 駒種ごとの字形。駒ごとに輪郭を書き写さず、`<use>` で参照する。 */
  glyphs: Record<TsumeShogiPieceType, string>;
};

export function createTsumeShogiRealPieceDefIds(
  id: string,
): TsumeShogiRealPieceDefIds {
  return {
    face: `${id}real-face`,
    edge: `${id}real-edge`,
    specular: `${id}real-specular`,
    ink: `${id}real-ink`,
    vermilion: `${id}real-vermilion`,
    glyphs: Object.fromEntries(
      pieceTypes.map((type) => [type, `${id}real-glyph-${type}`]),
    ) as Record<TsumeShogiPieceType, string>,
  };
}

type RealPieceDefsProps = {
  ids: TsumeShogiRealPieceDefIds;
};

export function RealPieceDefs({ ids }: RealPieceDefsProps) {
  return (
    <>
      <pattern
        id={ids.face}
        x={-TSUGE_TILE_WIDTH / 2}
        y={0}
        width={TSUGE_TILE_WIDTH}
        height={TSUGE_TILE_HEIGHT}
        patternUnits="userSpaceOnUse"
      >
        <image
          href={tsumeShogiWoodTextures.pieceFace}
          width={TSUGE_TILE_WIDTH}
          height={TSUGE_TILE_HEIGHT}
          preserveAspectRatio="none"
        />
      </pattern>
      <linearGradient id={ids.edge} x1="0" y1="0" x2="1" y2="1">
        <stop
          offset="0"
          stopOpacity="0.9"
          className={realTone.pieceEdgeLight}
        />
        <stop
          offset="0.4"
          stopOpacity="0"
          className={realTone.pieceEdgeLight}
        />
        <stop offset="0.6" stopOpacity="0" className={realTone.pieceEdgeDark} />
        <stop offset="1" stopOpacity="0.7" className={realTone.pieceEdgeDark} />
      </linearGradient>
      <radialGradient id={ids.specular} cx="0.32" cy="0.22" r="0.6">
        <stop
          offset="0"
          stopOpacity="0.3"
          className={realTone.pieceSpecular}
        />
        <stop offset="1" stopOpacity="0" className={realTone.pieceSpecular} />
      </radialGradient>
      <linearGradient id={ids.ink} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" className={realTone.inkTop} />
        <stop offset="0.35" className={realTone.inkMiddle} />
        <stop offset="1" className={realTone.inkBottom} />
      </linearGradient>
      <linearGradient id={ids.vermilion} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" className={realTone.vermilionTop} />
        <stop offset="0.4" className={realTone.vermilionMiddle} />
        <stop offset="1" className={realTone.vermilionBottom} />
      </linearGradient>
      {pieceTypes.map((type) => (
        <path
          key={type}
          id={ids.glyphs[type]}
          d={getTsumeShogiPieceGlyphPath(type)}
        />
      ))}
    </>
  );
}

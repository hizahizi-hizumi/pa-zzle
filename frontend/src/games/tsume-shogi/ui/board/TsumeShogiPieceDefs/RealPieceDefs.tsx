import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/board/real/wood-texture";

/** 案R の駒が参照する塗りの id。 */
export type TsumeShogiRealPieceDefIds = {
  /** 柘植の面の木目。駒の座標（0.1mm）に固定した1組の模様で、駒ごとに画像を置かない。 */
  face: string;
  /** 面取りの縁。左上の辺が光を受け、右下の辺が陰になる。駒の向きによらず画面の左上から光を当てる。 */
  edge: string;
  /** 面の左上に弱く乗るつや。 */
  specular: string;
  ink: string;
  vermilion: string;
  /** 駒の柔らかい影。影のぼかしはこの1つだけにする。 */
  softShadow: string;
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
    softShadow: `${id}real-soft-shadow`,
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
        x={-150}
        y={0}
        width={300}
        height={330}
        patternUnits="userSpaceOnUse"
      >
        <image
          href={tsumeShogiWoodTextures.pieceFace}
          width={300}
          height={330}
          preserveAspectRatio="none"
        />
      </pattern>
      <linearGradient id={ids.edge} x1="0" y1="0" x2="1" y2="1">
        <stop
          offset="0"
          stopOpacity="0.95"
          className={realTone.pieceEdgeLight}
        />
        <stop
          offset="0.45"
          stopOpacity="0"
          className={realTone.pieceEdgeLight}
        />
        <stop offset="0.6" stopOpacity="0" className={realTone.pieceEdgeDark} />
        <stop offset="1" stopOpacity="0.8" className={realTone.pieceEdgeDark} />
      </linearGradient>
      <radialGradient id={ids.specular} cx="0.3" cy="0.25" r="0.55">
        <stop
          offset="0"
          stopOpacity="0.16"
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
      <filter id={ids.softShadow} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
    </>
  );
}

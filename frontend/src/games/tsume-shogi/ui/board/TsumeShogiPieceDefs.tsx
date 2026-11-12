import { createContext, type ReactNode, useContext, useId } from "react";

import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/wood-texture";

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

/** 柘植の柾目の濃さ。緻密な材で木目は目立たないので、面の色にごく淡く重ねる。 */
const TSUGE_GRAIN_OPACITY = 0.06;
/** 虎斑の濃さ。等倍では柄を主張させず、木地の揺らぎとして見える濃さに抑える。 */
const TSUGE_FIGURE_OPACITY = 0.08;

/** 柘植の木目の1枚の大きさ（駒の座標 0.1mm）。駒2枚分ほどにし、模様ごとに位置をずらして同じ模様が並ばないようにする。 */
const TSUGE_TILE_WIDTH = 600;
const TSUGE_TILE_HEIGHT = 660;

/** 柘植の木目の模様の向き（度）と位置（0.1mm）。柾目がわずかに傾き、位相がずれて、同じ模様が並ばないようにする。 */
const tsugeFaceVariants = [
  { rotate: -4, x: 0, y: 0 },
  { rotate: 2, x: 137, y: 61 },
  { rotate: -1, x: 263, y: 190 },
  { rotate: 5, x: 71, y: 305 },
  { rotate: -3, x: 199, y: 122 },
  { rotate: 1, x: 331, y: 247 },
  { rotate: 3, x: 29, y: 403 },
  { rotate: -5, x: 412, y: 33 },
] as const;

const liftedShadowKinds = ["ambient", "core"] as const;
type LiftedShadowKind = (typeof liftedShadowKinds)[number];
/** 持ち上げた駒の影のぼけ（駒の座標 0.1mm）。盤から遠い影ほど大きくぼける。 */
const liftedShadowBlurs = {
  ambient: 16,
  core: 6,
} as const satisfies Record<LiftedShadowKind, number>;

/** 駒が参照する塗りと字形の id。 */
export type TsumeShogiPieceDefIds = {
  /** 柘植の面の木目（柾目と虎斑）。向きと位置の違う数組の模様で、駒ごとにどれかを選ぶ（`selectTsugeFace`）。駒ごとに画像を置かない。 */
  faces: readonly string[];
  /**
   * 面取りの斜面。光を受ける左上の辺を明るく、陰になる右下の辺を暗くし、駒を厚みのある板に見せる。
   * 駒の向きによらず画面の左上から光を当てる。
   */
  chamfer: string;
  /** 面のわずかな明暗。左上から右下へ、ごく弱く暗くする。 */
  shade: string;
  /** 面の左上に乗るつや。 */
  specular: string;
  /** 手前の側面の明暗。光から遠い右へ向かって暗くする。 */
  side: string;
  /** 持ち上げた駒の影のぼかし。遠く淡い影と近く濃い影で分ける。持ち上げる駒は1枚だけなので、ぼかしのフィルタを掛けてよい。 */
  liftedShadowBlurs: Record<LiftedShadowKind, string>;
  ink: string;
  vermilion: string;
  /** 駒種ごとの字形。駒ごとに輪郭を書き写さず、`<use>` で参照する。 */
  glyphs: Record<TsumeShogiPieceType, string>;
  /** 駒種ごとの字形の切り抜き。彫った溝の底の漆を、溝の内側にだけ描く。 */
  glyphClips: Record<TsumeShogiPieceType, string>;
};

/** 駒の識別から、その駒の木目の模様を選ぶ。同じ識別には同じ模様を返す。 */
export function selectTsugeFace(
  ids: TsumeShogiPieceDefIds,
  seed: string,
): string {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return ids.faces[(hash >>> 0) % ids.faces.length] ?? ids.faces[0] ?? "";
}

function createPieceDefIds(id: string): TsumeShogiPieceDefIds {
  return {
    faces: tsugeFaceVariants.map((_, index) => `${id}face-${index}`),
    chamfer: `${id}chamfer`,
    shade: `${id}shade`,
    specular: `${id}specular`,
    side: `${id}side`,
    liftedShadowBlurs: {
      ambient: `${id}lifted-shadow-blur-ambient`,
      core: `${id}lifted-shadow-blur-core`,
    },
    ink: `${id}ink`,
    vermilion: `${id}vermilion`,
    glyphs: Object.fromEntries(
      pieceTypes.map((type) => [type, `${id}glyph-${type}`]),
    ) as Record<TsumeShogiPieceType, string>,
    glyphClips: Object.fromEntries(
      pieceTypes.map((type) => [type, `${id}glyph-clip-${type}`]),
    ) as Record<TsumeShogiPieceType, string>,
  };
}

const TsumeShogiPieceDefsContext = createContext<TsumeShogiPieceDefIds | null>(
  null,
);

/** 内側の駒が参照する塗りの id。`TsumeShogiPieceDefs` の外では `null`。 */
export function useTsumeShogiPieceDefIds(): TsumeShogiPieceDefIds | null {
  return useContext(TsumeShogiPieceDefsContext);
}

type TsumeShogiPieceDefsProps = {
  children: ReactNode;
};

/**
 * 駒の木目・塗り・字形を1組だけ置き、内側の駒から参照させる。盤の81升に駒が並んでも、模様と字形は1組で済む。
 */
export function TsumeShogiPieceDefs({ children }: TsumeShogiPieceDefsProps) {
  const ids = createPieceDefIds(useId());

  return (
    <TsumeShogiPieceDefsContext value={ids}>
      {/* 塗りを参照できるよう、描画はするが大きさを持たない svg に置く（display: none では参照できない端末がある）。 */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute size-0 overflow-hidden"
      >
        <defs>
          {tsugeFaceVariants.map((variant, index) => (
            <pattern
              key={ids.faces[index]}
              id={ids.faces[index]}
              x={-TSUGE_TILE_WIDTH / 2 + variant.x}
              y={variant.y}
              width={TSUGE_TILE_WIDTH}
              height={TSUGE_TILE_HEIGHT}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${variant.rotate} 0 150)`}
            >
              <image
                href={tsumeShogiWoodTextures.pieceFace}
                width={TSUGE_TILE_WIDTH}
                height={TSUGE_TILE_HEIGHT}
                preserveAspectRatio="none"
                opacity={TSUGE_GRAIN_OPACITY}
              />
              <image
                href={tsumeShogiWoodTextures.pieceFigure}
                width={TSUGE_TILE_WIDTH}
                height={TSUGE_TILE_HEIGHT}
                preserveAspectRatio="none"
                opacity={TSUGE_FIGURE_OPACITY}
              />
            </pattern>
          ))}
          <linearGradient id={ids.chamfer} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0"
              stopOpacity="0.8"
              className={tone.pieceEdgeLight}
            />
            <stop
              offset="0.45"
              stopOpacity="0"
              className={tone.pieceEdgeLight}
            />
            <stop offset="0.55" stopOpacity="0" className={tone.pieceShade} />
            <stop offset="1" stopOpacity="0.38" className={tone.pieceShade} />
          </linearGradient>
          <linearGradient id={ids.shade} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0"
              stopOpacity="0.08"
              className={tone.pieceEdgeLight}
            />
            <stop
              offset="0.5"
              stopOpacity="0"
              className={tone.pieceEdgeLight}
            />
            <stop offset="0.5" stopOpacity="0" className={tone.pieceShade} />
            <stop offset="1" stopOpacity="0.14" className={tone.pieceShade} />
          </linearGradient>
          <radialGradient id={ids.specular} cx="0.32" cy="0.22" r="0.6">
            <stop offset="0" stopOpacity="0.2" className={tone.pieceSpecular} />
            <stop offset="1" stopOpacity="0" className={tone.pieceSpecular} />
          </radialGradient>
          <linearGradient id={ids.side} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopOpacity="0" className={tone.pieceShade} />
            <stop offset="1" stopOpacity="0.4" className={tone.pieceShade} />
          </linearGradient>
          {liftedShadowKinds.map((kind) => (
            <filter
              key={kind}
              id={ids.liftedShadowBlurs[kind]}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation={liftedShadowBlurs[kind]} />
            </filter>
          ))}
          <linearGradient id={ids.ink} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" className={tone.inkTop} />
            <stop offset="0.3" className={tone.inkMiddle} />
            <stop offset="1" className={tone.inkBottom} />
          </linearGradient>
          <linearGradient id={ids.vermilion} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" className={tone.vermilionTop} />
            <stop offset="0.4" className={tone.vermilionMiddle} />
            <stop offset="1" className={tone.vermilionBottom} />
          </linearGradient>
          {pieceTypes.map((type) => (
            <path
              key={type}
              id={ids.glyphs[type]}
              d={tsumeShogiPieceGlyphPaths[type]}
            />
          ))}
          {pieceTypes.map((type) => (
            <clipPath key={type} id={ids.glyphClips[type]}>
              <use href={`#${ids.glyphs[type]}`} />
            </clipPath>
          ))}
        </defs>
      </svg>
      {children}
    </TsumeShogiPieceDefsContext>
  );
}

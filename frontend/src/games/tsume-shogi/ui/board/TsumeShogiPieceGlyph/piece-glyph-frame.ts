import type {
  TsumeShogiPieceType,
  TsumeShogiSide,
} from "@/games/tsume-shogi/puzzle/position";
import {
  TSUME_SHOGI_SQUARE_HEIGHT,
  TSUME_SHOGI_SQUARE_WIDTH,
  type TsumeShogiPieceShape,
} from "@/games/tsume-shogi/ui/board/piece-shape";

/** 成った駒の種類。字を朱で書く。 */
export const promotedTypes: ReadonlySet<TsumeShogiPieceType> =
  new Set<TsumeShogiPieceType>([
    "dragon",
    "horse",
    "promSilver",
    "promKnight",
    "promLance",
    "promPawn",
  ]);

/** 駒を描く範囲は盤の1升。中心を原点にし、升に対する駒の大きさを実物のままにする。 */
export const squareViewBox = `${-TSUME_SHOGI_SQUARE_WIDTH / 2} ${-TSUME_SHOGI_SQUARE_HEIGHT / 2} ${TSUME_SHOGI_SQUARE_WIDTH} ${TSUME_SHOGI_SQUARE_HEIGHT}`;

/**
 * 駒の大きさの倍率。駒種ごとの実寸の比を保ったまま、升に対する比を実物の盤駒（玉で升幅の約 0.88）へ寄せる。
 * 実寸の駒形（`piece-shape.ts`）は升を実物の目盛りの寸法で取っており、そのままでは画面で駒が小さく見える。
 */
export const PIECE_SCALE = 1.1;

/**
 * 駒を置く升の大きさ。`board` は盤の升いっぱい、`choice` は下に「成」「不成」の札を置く成・不成の選択肢、
 * `hand` は持駒の駒台、`figure` は遊び方の図、`movement` は遊び方の駒の動きの図の中央の升。
 * どれも升の縦横比のまま、駒の大きさは升に対して実物の比率になる。
 */
export const glyphSizeClassNames = {
  board: "size-full",
  choice: "mb-2 aspect-[352/386] h-[88%]",
  hand: "aspect-[352/386] h-10",
  figure: "aspect-[352/386] h-7",
  movement: "aspect-[352/386] h-3.5",
} as const;

export type TsumeShogiPieceGlyphSize = keyof typeof glyphSizeClassNames;

/** 小さくて木目・面取り・艶を見分けられない大きさ。遊び方の図。 */
const miniatureGlyphSizes: ReadonlySet<TsumeShogiPieceGlyphSize> = new Set([
  "figure",
  "movement",
]);

export function isMiniatureGlyphSize(size: TsumeShogiPieceGlyphSize): boolean {
  return miniatureGlyphSizes.has(size);
}

export type TsumeShogiPieceGlyphProps = {
  type: TsumeShogiPieceType;
  side: TsumeShogiSide;
  size: TsumeShogiPieceGlyphSize;
  /** 選んで持ち上げている駒。駒を浮かせ、影を長くする。 */
  lifted?: boolean;
  /** 駒の、指し手で変わらない識別。駒ごとの木目の向きと位置を決める。 */
  grainSeed?: string;
};

/** 駒の外形・字の置き方。玉方の駒は頂点を下にし、字を 180° 回す。 */
export function getPieceGlyphLayout(
  shape: TsumeShogiPieceShape,
  side: TsumeShogiSide,
) {
  const defender = side === "defender";
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  return {
    outline: defender ? shape.defenderOutline : shape.outline,
    face: defender ? shape.defenderFace : shape.face,
    bodyTransform: `scale(${PIECE_SCALE}) translate(0 ${-shape.height / 2})`,
    glyphTransform: `translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`,
  };
}

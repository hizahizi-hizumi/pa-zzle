import type {
  TsumeShogiPieceType,
  TsumeShogiSide,
} from "@/games/tsume-shogi/puzzle/position";
import {
  TSUME_SHOGI_SQUARE_HEIGHT,
  TSUME_SHOGI_SQUARE_WIDTH,
} from "@/games/tsume-shogi/ui/board/piece-shape";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";

export const promotedTypes = new Set<TsumeShogiPieceType>([
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
 * 駒を置く升の大きさ。`board` は盤の升いっぱい、`choice` は下に「成」「不成」の札を置く成・不成の選択肢、
 * `hand` は持駒の駒台、`figure` は遊び方の図、`miniature` は難易度のプレビューの小さな盤の升いっぱい。
 * どれも升の縦横比のまま、駒の大きさは升に対して実物の比率になる。
 */
export const glyphSizeClassNames = {
  board: "size-full",
  choice: "mb-2 aspect-[352/386] h-[88%]",
  hand: "aspect-[352/386] h-10",
  figure: "aspect-[352/386] h-7",
  miniature: "size-full",
} as const;

export type TsumeShogiPieceGlyphSize = keyof typeof glyphSizeClassNames;

export type TsumeShogiPieceGlyphProps = {
  type: TsumeShogiPieceType;
  side: TsumeShogiSide;
  size: TsumeShogiPieceGlyphSize;
  /** 選んで持ち上げている駒。案R では駒を浮かせ、影を長くする。 */
  lifted?: boolean;
};

export function glyphTextClassName(type: TsumeShogiPieceType): string {
  return promotedTypes.has(type)
    ? tsumeShogiToneClassNames.promotedText
    : tsumeShogiToneClassNames.pieceText;
}

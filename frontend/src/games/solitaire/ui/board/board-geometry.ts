import { solitaireSuits } from "@/games/solitaire/puzzle/card";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import {
  SOLITAIRE_COLUMN_COUNT,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

const SOLITAIRE_BOARD_SIDE_PADDING_PX = 8;
const SOLITAIRE_COLUMN_GAP_PX = 4;
/** 上の段（山札・捨て札・組札）と列の間。 */
const SOLITAIRE_ROW_GAP_PX = 8;
/** 札の高さ ÷ 幅。 */
export const SOLITAIRE_CARD_ASPECT_RATIO = 1.4;
/** 列で重ねた札の、手前の札をずらす幅 ÷ 札の高さ。長い列で入りきらないときだけ、その列を詰める。 */
export const SOLITAIRE_CARD_OFFSET_RATIO = 0.3;
/** 縦に余裕のある画面で札を大きくしすぎないよう、この枚数の列がずらし幅を詰めずに入る大きさまでにする。 */
const unshrunkColumnCardCount = 13;

/**
 * 盤面の寸法（px）。横は上の段と列の7列の格子で、上の段は「山札・捨て札・空き・組札4つ」の順。
 * - `cardWidth` / `cardHeight`: 札1枚の大きさ。
 * - `contentWidth`: 7列と列の間を合わせた幅。盤面の中央に置く。
 * - `columnTop`: 列の一番奥の札の上端。
 * - `columnHeight`: 列が使える高さ。
 * - `columnOffsets`: 列ごとの、重ねた札をずらす幅。
 */
export type SolitaireBoardGeometry = {
  cardWidth: number;
  cardHeight: number;
  contentWidth: number;
  columnTop: number;
  columnHeight: number;
  columnOffsets: readonly number[];
};

export function getSolitaireBoardGeometry({
  width,
  height,
  columnLengths,
}: {
  width: number;
  height: number;
  columnLengths: readonly number[];
}): SolitaireBoardGeometry {
  const widthLimitedCardWidth =
    (width -
      SOLITAIRE_BOARD_SIDE_PADDING_PX * 2 -
      SOLITAIRE_COLUMN_GAP_PX * (SOLITAIRE_COLUMN_COUNT - 1)) /
    SOLITAIRE_COLUMN_COUNT;
  const heightLimitedCardHeight =
    (height - SOLITAIRE_ROW_GAP_PX) /
    (2 + (unshrunkColumnCardCount - 1) * SOLITAIRE_CARD_OFFSET_RATIO);
  const cardWidth = Math.max(
    0,
    Math.floor(
      Math.min(
        widthLimitedCardWidth,
        heightLimitedCardHeight / SOLITAIRE_CARD_ASPECT_RATIO,
      ),
    ),
  );
  const cardHeight = cardWidth * SOLITAIRE_CARD_ASPECT_RATIO;
  const columnTop = cardHeight + SOLITAIRE_ROW_GAP_PX;
  const columnHeight = Math.max(0, height - columnTop);
  const naturalOffset = cardHeight * SOLITAIRE_CARD_OFFSET_RATIO;
  return {
    cardWidth,
    cardHeight,
    contentWidth:
      cardWidth * SOLITAIRE_COLUMN_COUNT +
      SOLITAIRE_COLUMN_GAP_PX * (SOLITAIRE_COLUMN_COUNT - 1),
    columnTop,
    columnHeight,
    columnOffsets: columnLengths.map((length) =>
      length <= 1
        ? naturalOffset
        : Math.max(
            0,
            Math.min(naturalOffset, (columnHeight - cardHeight) / (length - 1)),
          ),
    ),
  };
}

/** 7列の格子で、左から `slotIndex` 番目（0始まり）の札の左端。 */
export function getSolitaireSlotLeft(
  geometry: SolitaireBoardGeometry,
  slotIndex: number,
): number {
  return slotIndex * (geometry.cardWidth + SOLITAIRE_COLUMN_GAP_PX);
}

/** 上の段の山の、7列の格子での位置。左から山札・捨て札・空き・組札4つ（`solitaireSuits` の順）。 */
export function getSolitaireTopRowSlotIndex(
  pile: Exclude<SolitairePile, { pile: "column" }>,
): number {
  switch (pile.pile) {
    case "stock":
      return 0;
    case "waste":
      return 1;
    case "foundation":
      return 3 + solitaireSuits.indexOf(pile.suit);
  }
}

/** 盤面の札の左上の位置（px）。`left` は7列の格子の左端から、`top` は上の段の上端から。 */
export type SolitaireCardPosition = { left: number; top: number };

/** 列 `columnIndex` の奥から `cardIndex` 番目（0始まり）の札の位置。 */
export function getSolitaireColumnCardPosition(
  geometry: SolitaireBoardGeometry,
  columnIndex: number,
  cardIndex: number,
): SolitaireCardPosition {
  return {
    left: getSolitaireSlotLeft(geometry, columnIndex),
    top:
      geometry.columnTop +
      cardIndex * (geometry.columnOffsets[columnIndex] ?? 0),
  };
}

/** 山の一番上（列は一番手前）の札の位置。札の無い山は、札を置く跡の位置。 */
export function getSolitairePileTopPosition(
  geometry: SolitaireBoardGeometry,
  state: SolitaireState,
  pile: SolitairePile,
): SolitaireCardPosition {
  if (pile.pile === "column") {
    const length = state.columns[pile.columnIndex]?.length ?? 0;
    return getSolitaireColumnCardPosition(
      geometry,
      pile.columnIndex,
      Math.max(0, length - 1),
    );
  }
  return {
    left: getSolitaireSlotLeft(geometry, getSolitaireTopRowSlotIndex(pile)),
    top: 0,
  };
}

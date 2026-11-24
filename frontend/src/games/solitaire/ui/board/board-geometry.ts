import { solitaireSuits } from "@/games/solitaire/puzzle/card";
import {
  isSameSolitairePile,
  type SolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
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

export type SolitaireTopRowPile = Exclude<SolitairePile, { pile: "column" }>;

/**
 * 盤面に並べる山。上の段と列を同じ格子に左から並べる。
 * - `topRow`: 上の段の山。`null` は空けておく枠。
 * - `columns`: 並べる列の番号。
 */
export type SolitaireBoardLayout = {
  topRow: readonly (SolitaireTopRowPile | null)[];
  columns: readonly number[];
};

/** プレイ画面の盤面。上の段は「山札・捨て札・空き・組札4つ（`solitaireSuits` の順）」、下に7列。 */
export const solitaireFullLayout: SolitaireBoardLayout = {
  topRow: [
    { pile: "stock" },
    { pile: "waste" },
    null,
    ...solitaireSuits.map((suit) => ({ pile: "foundation", suit }) as const),
  ],
  columns: Array.from({ length: SOLITAIRE_COLUMN_COUNT }, (_, index) => index),
};

/**
 * 盤面の寸法（px）。
 * - `cardWidth` / `cardHeight`: 札1枚の大きさ。
 * - `contentWidth`: 並べる山と山の間を合わせた幅。盤面の中央に置く。
 * - `columnTop`: 列の一番奥の札の上端。上の段の無い盤面では 0。
 * - `columnHeight`: 列が使える高さ。
 * - `columnOffsets`: 列の番号ごとの、重ねた札をずらす幅。
 */
export type SolitaireBoardGeometry = {
  layout: SolitaireBoardLayout;
  cardWidth: number;
  cardHeight: number;
  contentWidth: number;
  columnTop: number;
  columnHeight: number;
  columnOffsets: readonly number[];
};

function getSlotCount({ topRow, columns }: SolitaireBoardLayout): number {
  return Math.max(topRow.length, columns.length);
}

function getContentWidth(layout: SolitaireBoardLayout, cardWidth: number) {
  const slotCount = getSlotCount(layout);
  return cardWidth * slotCount + SOLITAIRE_COLUMN_GAP_PX * (slotCount - 1);
}

/** プレイ画面の盤面の寸法。測った盤面の大きさに7列と上の段を収め、入りきらない長い列だけずらし幅を詰める。 */
export function getSolitaireBoardGeometry({
  width,
  height,
  columnLengths,
}: {
  width: number;
  height: number;
  columnLengths: readonly number[];
}): SolitaireBoardGeometry {
  const layout = solitaireFullLayout;
  const slotCount = getSlotCount(layout);
  const widthLimitedCardWidth =
    (width -
      SOLITAIRE_BOARD_SIDE_PADDING_PX * 2 -
      SOLITAIRE_COLUMN_GAP_PX * (slotCount - 1)) /
    slotCount;
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
    layout,
    cardWidth,
    cardHeight,
    contentWidth: getContentWidth(layout, cardWidth),
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

/**
 * 決まった大きさの札で描く盤面（遊び方の例など）の寸法。どの列も詰めずに重ね、列には `columnCardCapacity` 枚が入る高さを取る。
 */
export function getSolitaireFixedBoardGeometry({
  layout,
  cardWidth,
  columnCardCapacity,
}: {
  layout: SolitaireBoardLayout;
  cardWidth: number;
  columnCardCapacity: number;
}): SolitaireBoardGeometry {
  const cardHeight = cardWidth * SOLITAIRE_CARD_ASPECT_RATIO;
  const offset = cardHeight * SOLITAIRE_CARD_OFFSET_RATIO;
  return {
    layout,
    cardWidth,
    cardHeight,
    contentWidth: getContentWidth(layout, cardWidth),
    columnTop: layout.topRow.length > 0 ? cardHeight + SOLITAIRE_ROW_GAP_PX : 0,
    columnHeight:
      layout.columns.length > 0
        ? cardHeight + Math.max(0, columnCardCapacity - 1) * offset
        : 0,
    columnOffsets: Array.from({ length: SOLITAIRE_COLUMN_COUNT }, () => offset),
  };
}

/** 盤面全体の高さ。上の段だけの盤面は札1枚の高さ。 */
export function getSolitaireBoardContentHeight(
  geometry: SolitaireBoardGeometry,
): number {
  return geometry.layout.columns.length > 0
    ? geometry.columnTop + geometry.columnHeight
    : geometry.cardHeight;
}

/** 格子の左から `slotIndex` 番目（0始まり）の札の左端。 */
export function getSolitaireSlotLeft(
  geometry: SolitaireBoardGeometry,
  slotIndex: number,
): number {
  return slotIndex * (geometry.cardWidth + SOLITAIRE_COLUMN_GAP_PX);
}

/** 山の、格子での位置。盤面に並べない山は -1。 */
export function getSolitairePileSlotIndex(
  geometry: SolitaireBoardGeometry,
  pile: SolitairePile,
): number {
  const { layout } = geometry;
  return pile.pile === "column"
    ? layout.columns.indexOf(pile.columnIndex)
    : layout.topRow.findIndex(
        (topRowPile) =>
          topRowPile !== null && isSameSolitairePile(topRowPile, pile),
      );
}

/** 盤面の札の左上の位置（px）。`left` は格子の左端から、`top` は盤面の上端から。 */
export type SolitaireCardPosition = { left: number; top: number };

/** 列 `columnIndex` の奥から `cardIndex` 番目（0始まり）の札の位置。 */
export function getSolitaireColumnCardPosition(
  geometry: SolitaireBoardGeometry,
  columnIndex: number,
  cardIndex: number,
): SolitaireCardPosition {
  return {
    left: getSolitaireSlotLeft(
      geometry,
      getSolitairePileSlotIndex(geometry, { pile: "column", columnIndex }),
    ),
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
    left: getSolitaireSlotLeft(
      geometry,
      getSolitairePileSlotIndex(geometry, pile),
    ),
    top: 0,
  };
}

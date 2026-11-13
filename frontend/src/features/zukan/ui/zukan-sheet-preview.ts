import {
  findZukanPieceShape,
  getZukanPiecePath,
  ZUKAN_PIECE_GROOVE_WIDTH,
} from "@/features/zukan/ui/zukan-piece-shape";
import {
  countZukanSheetColumns,
  estimateZukanSheetMaxVisibleHeightPx,
  estimateZukanSheetWidthPx,
} from "@/features/zukan/ui/zukan-sheet-layout";

import type { ZukanProblemStatus } from "@/features/zukan/zukan-collection";

/** ゲームのホームを開く前に見せる、台紙の絵。台紙と同じ列の数・同じピースの形・同じ状態の色で、全部の行を描く。 */
export type ZukanSheetPreview = {
  imageUrl: string;
  /** 同じ並びの、ピースの間の溝だけの絵。台紙に載せる絵柄の上に重ね、絵柄をジグソーに刷った絵として見せるのに使う。 */
  groovesImageUrl: string;
  columnCount: number;
  rowCount: number;
  /** 初めに見せる行。最後に解いた問題のあたりが見える所。台紙の上から数えた 0 始まりの位置。 */
  firstRow: number;
  /** ゲームのホームが台紙を見せ始められる、最後の行。台紙は、末尾の行を見せる範囲の下端より上へは送れない。 */
  lastOpenableRow: number;
};

// 台紙のピースの間の溝の色と、解いていないピースの色。台紙の背景の色と、`untouched`・`attempted` の塗りに合わせる。
const GROOVE_COLOR = "oklch(1 0 0)";
const UNSOLVED_COLORS = {
  untouched: "oklch(0.95 0 0)",
  attempted: "oklch(0.86 0 0)",
} as const;

/** 状態の色。解いた問題の色は評価段階のトークンで、絵には値を書くので、今の値を読む。 */
function findStatusColor(status: ZukanProblemStatus): string {
  if (status === "untouched" || status === "attempted") {
    return UNSOLVED_COLORS[status];
  }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--grade-${status}`)
    .trim();
}

/** 台紙の絵と、同じ並びの溝だけの絵。 */
function drawSheet(
  columnCount: number,
  rowCount: number,
  statuses: readonly ZukanProblemStatus[],
): { sheet: string; grooves: string } {
  const problemCount = statuses.length;
  const shapeIds = new Map<string, string>();
  const definitions: string[] = [];
  const pieces: string[] = [];
  const outlines: string[] = [];
  for (const [position, status] of statuses.entries()) {
    const shape = findZukanPieceShape(
      position,
      problemCount,
      problemCount,
      columnCount,
    );
    let id = shapeIds.get(shape);
    if (id === undefined) {
      id = `s${shapeIds.size}`;
      shapeIds.set(shape, id);
      definitions.push(`<path id="${id}" d="${getZukanPiecePath(shape)}"/>`);
    }
    const fill =
      status === "untouched" ? "" : ` fill="${findStatusColor(status)}"`;
    const place = `x="${position % columnCount}" y="${Math.floor(position / columnCount)}"`;
    pieces.push(`<use href="#${id}" ${place}${fill}/>`);
    outlines.push(`<use href="#${id}" ${place}/>`);
  }
  function draw(fill: string, uses: readonly string[]): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columnCount} ${rowCount}" preserveAspectRatio="none"><defs>${definitions.join("")}</defs><g fill="${fill}" stroke="${GROOVE_COLOR}" stroke-width="${ZUKAN_PIECE_GROOVE_WIDTH}" stroke-linejoin="round">${uses.join("")}</g></svg>`;
  }
  return {
    sheet: draw(UNSOLVED_COLORS.untouched, pieces),
    grooves: draw("none", outlines),
  };
}

/** 作り置く絵の数の上限。ゲームの数と、画面の向きを変えたときの分を持てる数にする。 */
const MAX_PREVIEW_COUNT = 32;
const previews = new Map<string, ZukanSheetPreview>();

/**
 * 台紙を、今の画面の大きさでゲームのホームに開いたときの並びで描く。`statuses` は、台紙の全問の状態を番号の順に並べたもの。
 * `focusIndex` の問題があれば、その行が、額に収まる行（列の数と同じ）の中ほどに来る所を、初めに見せる行にする。
 * 同じ姿には作り置いた絵を返す。
 */
export function getZukanSheetPreview(
  statuses: readonly ZukanProblemStatus[],
  focusIndex: number | null,
  viewportWidthPx: number,
  viewportHeightPx: number,
): ZukanSheetPreview {
  const problemCount = statuses.length;
  const sheetWidthPx = estimateZukanSheetWidthPx(viewportWidthPx);
  const columnCount = countZukanSheetColumns(sheetWidthPx, problemCount);
  const squareSizePx = sheetWidthPx / columnCount;
  const rowCount = Math.max(1, Math.ceil(problemCount / columnCount));
  const firstRow =
    focusIndex === null
      ? 0
      : Math.max(
          0,
          Math.min(
            Math.floor(focusIndex / columnCount) - Math.floor(columnCount / 2),
            rowCount - columnCount,
          ),
        );
  const lastOpenableRow = Math.max(
    0,
    rowCount -
      Math.ceil(
        estimateZukanSheetMaxVisibleHeightPx(viewportHeightPx) / squareSizePx,
      ),
  );
  const key = `${columnCount}:${firstRow}:${lastOpenableRow}:${statuses.join(",")}`;
  const cached = previews.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const { sheet, grooves } = drawSheet(columnCount, rowCount, statuses);
  const preview = {
    imageUrl: `data:image/svg+xml,${encodeURIComponent(sheet)}`,
    groovesImageUrl: `data:image/svg+xml,${encodeURIComponent(grooves)}`,
    columnCount,
    rowCount,
    firstRow,
    lastOpenableRow,
  };
  // 画面の大きさや状態が変わるたびに増え続けないよう、古い絵から捨てる。
  if (previews.size >= MAX_PREVIEW_COUNT) {
    const oldestKey = previews.keys().next().value;
    if (oldestKey !== undefined) previews.delete(oldestKey);
  }
  previews.set(key, preview);
  return preview;
}

import {
  findZukanPieceShape,
  getZukanPiecePath,
  ZUKAN_PIECE_GROOVE_WIDTH,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import {
  countZukanSheetColumns,
  estimateZukanSheetMaxVisibleHeightPx,
  estimateZukanSheetWidthPx,
} from "@/zukan/ui/zukan-sheet-layout";

import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

/** ゲームのホームを開く前に見せる、台紙の絵。台紙と同じ列の数・同じピースの形・同じ状態の色で、台紙の `firstRow` 行目から `rowCount` 行を描く。 */
export type ZukanSheetPreview = {
  imageUrl: string;
  columnCount: number;
  /** 描いた最初の行。台紙の上から数えた 0 始まりの位置。 */
  firstRow: number;
  /** ゲームのホームが台紙を見せ始める行。`firstRow` か、台紙をそこまで送れないときは送れる最後の行。 */
  openingRow: number;
  rowCount: number;
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

function drawSheet(
  columnCount: number,
  firstRow: number,
  rowCount: number,
  statuses: readonly ZukanProblemStatus[],
): string {
  const problemCount = statuses.length;
  const firstPosition = firstRow * columnCount;
  const lastPosition = Math.min(
    problemCount,
    firstPosition + rowCount * columnCount,
  );
  const shapeIds = new Map<string, string>();
  const definitions: string[] = [];
  const pieces: string[] = [];
  for (let position = firstPosition; position < lastPosition; position += 1) {
    const status = statuses[position] ?? "untouched";
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
    pieces.push(
      `<use href="#${id}" x="${position % columnCount}" y="${Math.floor(position / columnCount) - firstRow}"${fill}/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columnCount} ${rowCount}" preserveAspectRatio="none"><defs>${definitions.join("")}</defs><g fill="${UNSOLVED_COLORS.untouched}" stroke="${GROOVE_COLOR}" stroke-width="${ZUKAN_PIECE_GROOVE_WIDTH}" stroke-linejoin="round">${pieces.join("")}</g></svg>`;
}

const previews = new Map<string, ZukanSheetPreview>();

/**
 * 台紙を、今の画面の大きさでゲームのホームに開いたときの姿で描く。`statuses` は、台紙の全問の状態を番号の順に並べたもの。
 * 行は、台紙が画面に見せられる分だけ描く。`focusIndex` の問題があれば、その行が描いた範囲の上から列の数の半分ほどの所に来るように、描き始める行を決める。
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
  const rowCount = Math.max(
    1,
    Math.min(
      Math.ceil(problemCount / columnCount),
      Math.ceil(viewportHeightPx / squareSizePx),
    ),
  );
  const totalRowCount = Math.ceil(problemCount / columnCount);
  // 絵は、額に収まる行（列の数と同じ）が台紙の末尾を越えない所から描く。
  const firstRow =
    focusIndex === null
      ? 0
      : Math.max(
          0,
          Math.min(
            Math.floor(focusIndex / columnCount) - Math.floor(columnCount / 2),
            totalRowCount - columnCount,
          ),
        );
  // ゲームのホームの台紙は、末尾の行を見せる範囲の下端より上へは送れない。
  const lastOpenableRow =
    totalRowCount -
    Math.ceil(
      estimateZukanSheetMaxVisibleHeightPx(viewportHeightPx) / squareSizePx,
    );
  const openingRow = Math.max(0, Math.min(firstRow, lastOpenableRow));
  const drawnStatuses = statuses.slice(
    firstRow * columnCount,
    (firstRow + rowCount) * columnCount,
  );
  const key = `${columnCount}:${firstRow}:${openingRow}:${rowCount}:${problemCount}:${drawnStatuses.map((status) => status.slice(0, 2)).join("")}`;
  const cached = previews.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const preview = {
    imageUrl: `data:image/svg+xml,${encodeURIComponent(drawSheet(columnCount, firstRow, rowCount, statuses))}`,
    columnCount,
    firstRow,
    openingRow,
    rowCount,
  };
  previews.set(key, preview);
  return preview;
}
